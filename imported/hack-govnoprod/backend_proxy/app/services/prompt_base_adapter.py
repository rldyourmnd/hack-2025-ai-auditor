from __future__ import annotations

import logging
from typing import Optional

import httpx

from ..config import Settings


logger = logging.getLogger(__name__)


def _backend_base() -> str:
    # Reuse same base used for upstream backend calls
    return Settings().backend_api_url or "http://api:8000"


def _extract_forward_headers(incoming_headers: dict[str, str]) -> dict[str, str]:
    headers: dict[str, str] = {}
    auth_header = incoming_headers.get("authorization") or incoming_headers.get("Authorization")
    cookie_header = incoming_headers.get("cookie") or incoming_headers.get("Cookie")
    traceparent = incoming_headers.get("traceparent")
    x_request_id = incoming_headers.get("x-request-id") or incoming_headers.get("X-Request-Id")
    if auth_header:
        headers["authorization"] = auth_header
    if cookie_header:
        headers["cookie"] = cookie_header
    if traceparent:
        headers["traceparent"] = traceparent
    if x_request_id:
        headers["x-request-id"] = x_request_id
    return headers


async def get_prompt_content(prompt_id: str, incoming_headers: dict[str, str]) -> str:
    """
    Fetch prompt by id from upstream Prompt Base and return its content string.

    Raises httpx.TimeoutException mapped by caller; returns 404 via http error status for not found.
    """
    base = _backend_base()
    url = f"{base}/prompt-base/prompts/{prompt_id}"
    timeout = Settings().backend_timeout
    headers = _extract_forward_headers(incoming_headers)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.get(url, headers=headers)
        except httpx.TimeoutException as exc:
            logger.error("prompt_base_adapter timeout GET %s: %s", url, exc)
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("prompt_base_adapter network error GET %s: %s", url, exc)
            raise
    if resp.status_code == 404:
        # propagate 404 to caller (they'll convert to HTTPException)
        raise httpx.HTTPStatusError("not found", request=resp.request, response=resp)
    if resp.status_code >= 400:
        logger.error("prompt_base_adapter upstream error %s body=%s", resp.status_code, resp.text)
        raise httpx.HTTPStatusError("upstream error", request=resp.request, response=resp)
    data = resp.json()
    content: Optional[str] = None
    # Expect upstream PromptRead shape: { ..., content: str, ... }
    if isinstance(data, dict):
        content = data.get("content")
    if not content:
        logger.error("prompt_base_adapter: prompt content missing in upstream response for id=%s", prompt_id)
        raise ValueError("prompt content missing")

    return content

import asyncio
import json
import random
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import httpx

from ..config import Settings


IDEMPOTENT_METHODS = {"GET", "HEAD", "OPTIONS"}


class UpstreamTimeoutError(Exception):
    pass


class UpstreamNetworkError(Exception):
    pass


def _now_ms() -> int:
    return int(time.time() * 1000)


@dataclass
class _CircuitState:
    is_open: bool = False
    open_until_ts_ms: int = 0
    recent_failures: list[int] = None  # unix ms

    def __post_init__(self) -> None:
        if self.recent_failures is None:
            self.recent_failures = []


class PromptBaseAdapter:
    """HTTP adapter for internal Prompt Base upstream.

    Responsibilities:
    - Async HTTP client with connection pooling
    - Concurrency limiting via semaphore
    - Simple circuit breaker (fail threshold over short window → open, then half-open)
    - Retries for idempotent methods with jitter backoff
    - Optional in-memory cache for safe GETs
    - SSRF allowlist validation for base host
    - Request/response body size caps
    - Minimal header propagation (Authorization/traceparent/x-request-id/Idempotency-Key)
    """

    def __init__(self, settings: Settings) -> None:
        if not settings.backend_timeout:
            settings.backend_timeout = 120
        self._settings = settings

        if not settings.prompt_base_url:
            raise ValueError("PROMPT_BASE_URL is required for PromptBaseAdapter")

        # SSRF allowlist check for base host
        base_host = httpx.URL(settings.prompt_base_url).host
        allow = set(settings.prompt_base_allowed_hosts or [])
        if allow and base_host not in allow:
            raise ValueError(f"Upstream host '{base_host}' not in PROMPT_BASE_ALLOWED_HOSTS")

        self._timeout = httpx.Timeout(settings.prompt_base_timeout or 30.0)
        self._client: Optional[httpx.AsyncClient] = None
        self._limits = httpx.Limits(
            max_connections=settings.prompt_base_concurrency or 64,
            max_keepalive_connections=min(32, (settings.prompt_base_concurrency or 64)),
        )
        self._sem = asyncio.Semaphore(settings.prompt_base_concurrency or 64)

        # circuit breaker state
        self._cb = _CircuitState()

        # in-memory cache for GET
        self._cache_ttl = int(settings.prompt_base_cache_ttl or 0)
        self._cache: Dict[str, Tuple[int, Any]] = {}
        self._cache_lock = asyncio.Lock()

        # body size caps
        self._max_body_bytes = int(settings.prompt_base_max_body_bytes or 1024 * 1024)

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self._settings.prompt_base_url,
                timeout=self._timeout,
                limits=self._limits,
                headers={"User-Agent": "backend-proxy/PromptBaseAdapter"},
            )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    def _cb_should_short_circuit(self) -> bool:
        if not self._cb.is_open:
            return False
        return _now_ms() < self._cb.open_until_ts_ms

    def _cb_on_failure(self) -> None:
        now = _now_ms()
        # keep last ~30s of failures
        window_ms = max(30_000, int(self._settings.prompt_base_circuit_reset_sec or 30) * 1000)
        self._cb.recent_failures.append(now)
        self._cb.recent_failures = [t for t in self._cb.recent_failures if now - t <= window_ms]
        threshold = int(self._settings.prompt_base_circuit_fail_threshold or 20)
        if len(self._cb.recent_failures) >= threshold and not self._cb.is_open:
            self._cb.is_open = True
            self._cb.open_until_ts_ms = now + window_ms

    def _cb_on_success(self) -> None:
        self._cb.recent_failures.clear()
        self._cb.is_open = False
        self._cb.open_until_ts_ms = 0

    def _cache_key(self, path: str, query: Optional[dict] = None, auth: Optional[str] = None) -> str:
        # respect auth scope by default
        scope = "auth" if auth else "anon"
        return json.dumps({"p": path, "q": query or {}, "s": scope}, sort_keys=True)

    async def _cache_get(self, key: str) -> Optional[Any]:
        if self._cache_ttl <= 0:
            return None
        async with self._cache_lock:
            item = self._cache.get(key)
            if not item:
                return None
            exp, val = item
            if _now_ms() > exp:
                # expire lazy
                self._cache.pop(key, None)
                return None
            return val

    async def _cache_put(self, key: str, value: Any) -> None:
        if self._cache_ttl <= 0:
            return
        async with self._cache_lock:
            self._cache[key] = (_now_ms() + self._cache_ttl * 1000, value)

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[dict] = None,
        json_body: Optional[dict] = None,
        headers_in: Optional[dict] = None,
    ) -> Tuple[int, Dict[str, Any], Dict[str, str]]:
        """Perform upstream request with concurrency, retries, and CB.

        Returns (status_code, json_body, response_headers)
        Raises UpstreamNetworkError | UpstreamTimeoutError on transport errors
        """
        if self._cb_should_short_circuit():
            # simulate immediate service unavailable
            return 503, {"error_code": "upstream_unavailable", "message": "Prompt Base circuit open"}, {
                "Retry-After": str(self._settings.prompt_base_circuit_reset_sec or 30)
            }

        # size checks
        if json_body is not None:
            try:
                encoded = json.dumps(json_body).encode("utf-8")
            except Exception:
                encoded = b"{}"
            if len(encoded) > self._max_body_bytes:
                return 413, {"error_code": "request_too_large", "message": "request body too large"}, {}

        incoming_auth = (headers_in or {}).get("authorization") or (headers_in or {}).get("Authorization")
        auth_header = (
            incoming_auth
            if incoming_auth
            else (f"Bearer {self._settings.prompt_base_service_token}" if self._settings.prompt_base_service_token else None)
        )

        # cache for GET
        cache_key = None
        if method.upper() == "GET" and self._cache_ttl > 0:
            cache_key = self._cache_key(path, params, auth_header)
            cached = await self._cache_get(cache_key)
            if cached is not None:
                return 200, cached, {"X-Cache": "HIT"}

        # header propagation
        headers = {}
        if auth_header:
            headers["Authorization"] = auth_header
        for hname in ("traceparent", "x-request-id", "Idempotency-Key"):
            if headers_in and hname in headers_in:
                headers[hname] = headers_in[hname]

        attempt = 0
        max_retries = int(self._settings.prompt_base_max_retries or 2)
        backoff_ms = int(self._settings.prompt_base_retry_backoff_ms or 300)

        # Acquire concurrency semaphore
        async with self._sem:
            while True:
                attempt += 1
                try:
                    client = await self._get_client()
                    resp = await client.request(method, path, params=params, json=json_body, headers=headers)
                except httpx.TimeoutException as exc:
                    self._cb_on_failure()
                    if method.upper() in IDEMPOTENT_METHODS and attempt <= max_retries + 1:
                        await asyncio.sleep((backoff_ms / 1000.0) * (2 ** (attempt - 1)) + random.uniform(0, 0.2))
                        continue
                    raise UpstreamTimeoutError(str(exc))
                except httpx.HTTPError as exc:
                    self._cb_on_failure()
                    if method.upper() in IDEMPOTENT_METHODS and attempt <= max_retries + 1:
                        await asyncio.sleep((backoff_ms / 1000.0) * (2 ** (attempt - 1)) + random.uniform(0, 0.2))
                        continue
                    raise UpstreamNetworkError(str(exc))

                # success path
                try:
                    data = resp.json()
                except Exception:
                    data = {"message": resp.text[:2000]}

                # response body size cap
                try:
                    encoded = json.dumps(data).encode("utf-8")
                    if len(encoded) > self._max_body_bytes:
                        data = {"error_code": "response_too_large", "message": "response body too large"}
                        status = 502
                    else:
                        status = resp.status_code
                except Exception:
                    status = resp.status_code

                # update circuit breaker
                if 500 <= status < 600:
                    self._cb_on_failure()
                else:
                    self._cb_on_success()

                # cache only 200 OK GETs
                if status == 200 and method.upper() == "GET" and cache_key is not None:
                    await self._cache_put(cache_key, data)

                # pass through headers we care about
                out_headers = {}
                if "Retry-After" in resp.headers:
                    out_headers["Retry-After"] = resp.headers["Retry-After"]

                return status, data, out_headers

    # --- Public high-level methods mapping to upstream ---

    async def add(self, payload: dict, headers_in: Optional[dict] = None) -> Tuple[int, dict, dict]:
        return await self._request("POST", "/prompt-base/add", json_body=payload, headers_in=hashable_headers(headers_in))

    async def check(self, payload: dict, headers_in: Optional[dict] = None) -> Tuple[int, dict, dict]:
        return await self._request("POST", "/prompt-base/check", json_body=payload, headers_in=hashable_headers(headers_in))

    async def list(self, params: Optional[dict] = None, headers_in: Optional[dict] = None) -> Tuple[int, dict, dict]:
        return await self._request("GET", "/prompt-base/prompts", params=params, headers_in=hashable_headers(headers_in))

    async def get(self, prompt_id: str, headers_in: Optional[dict] = None) -> Tuple[int, dict, dict]:
        return await self._request("GET", f"/prompt-base/prompts/{prompt_id}", headers_in=hashable_headers(headers_in))

    async def update(self, prompt_id: str, payload: dict, headers_in: Optional[dict] = None) -> Tuple[int, dict, dict]:
        return await self._request("PUT", f"/prompt-base/prompts/{prompt_id}", json_body=payload, headers_in=hashable_headers(headers_in))

    async def delete(self, prompt_id: str, headers_in: Optional[dict] = None) -> Tuple[int, dict, dict]:
        return await self._request("DELETE", f"/prompt-base/prompts/{prompt_id}", headers_in=hashable_headers(headers_in))

    async def search(self, params: Optional[dict] = None, headers_in: Optional[dict] = None) -> Tuple[int, dict, dict]:
        return await self._request("GET", "/prompt-base/search", params=params, headers_in=hashable_headers(headers_in))

    async def create_relation(self, from_id: str, to_id: str, relation_type: str, description: Optional[str] = None, headers_in: Optional[dict] = None) -> Tuple[int, dict, dict]:
        body = {"from_id": from_id, "to_id": to_id, "relation_type": relation_type}
        if description:
            body["description"] = description
        return await self._request("POST", "/prompt-base/relations", json_body=body, headers_in=hashable_headers(headers_in))

    async def list_relations(self, prompt_id: str, params: Optional[dict] = None, headers_in: Optional[dict] = None) -> Tuple[int, dict, dict]:
        return await self._request("GET", f"/prompt-base/prompts/{prompt_id}/relations", params=params, headers_in=hashable_headers(headers_in))

    async def delete_relation(self, relation_id: str, headers_in: Optional[dict] = None) -> Tuple[int, dict, dict]:
        return await self._request("DELETE", f"/prompt-base/relations/{relation_id}", headers_in=hashable_headers(headers_in))


def hashable_headers(headers: Optional[dict]) -> dict:
    """Normalize headers dict to str keys suitable for case-sensitive lookup.
    Accepts possibly None; returns empty dict if None.
    """
    if not headers:
        return {}
    return {str(k): str(v) for k, v in headers.items()}


# Simple lazy singleton to be used by routers during transition
_adapter_singleton: Optional[PromptBaseAdapter] = None
_adapter_lock = asyncio.Lock()


async def get_prompt_base_adapter() -> PromptBaseAdapter:
    global _adapter_singleton
    if _adapter_singleton is None:
        async with _adapter_lock:
            if _adapter_singleton is None:
                _adapter_singleton = PromptBaseAdapter(Settings())
    return _adapter_singleton


