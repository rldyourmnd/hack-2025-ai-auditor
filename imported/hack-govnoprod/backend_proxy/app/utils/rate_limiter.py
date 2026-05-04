from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Deque

from fastapi import HTTPException, Request


class SlidingWindowLimiter:
    def __init__(self, max_requests: int, window_sec: int) -> None:
        self.max_requests = max_requests
        self.window = window_sec
        self._store: dict[str, Deque[float]] = defaultdict(deque)

    def _key_for(self, request: Request) -> str:
        client = getattr(request.client, "host", "?")
        token = request.headers.get("authorization", "")
        # Simple composite key: IP + first 16 of token for coarse-grained limiting
        return f"{client}:{token[:16]}"

    def check(self, request: Request) -> None:
        key = self._key_for(request)
        now = time.time()
        q = self._store[key]
        # drop old timestamps
        while q and (now - q[0]) > self.window:
            q.popleft()
        if len(q) >= self.max_requests:
            retry_after = max(1, int(self.window - (now - q[0]))) if q else 1
            raise HTTPException(status_code=429, detail={"error_code": "rate_limited", "message": "Too Many Requests"}, headers={"Retry-After": str(retry_after)})
        q.append(now)


