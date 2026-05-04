from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings
from .utils.metrics import record_basic_metrics
from .utils.rate_limiter import SlidingWindowLimiter


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    # Expose OpenAPI UI at /docs and OpenAPI JSON at /openapi.json
    app = FastAPI(title="backend_proxy", docs_url="/docs", openapi_url="/openapi.json", redoc_url=None)

    # CORS
    # In development allow permissive origins to make extension/web debugging easier.
    cors_allow = settings.cors_origins if not settings.is_development else ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_allow,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
        expose_headers=["*"],
    )

    # Basic metrics middleware
    app.middleware("http")(record_basic_metrics)

    # Simple rate limiter for prompts-related paths
    limiter = SlidingWindowLimiter(max_requests=settings.rate_limit, window_sec=settings.rate_limit_window_sec)

    @app.middleware("http")
    async def _rate_limit_mw(request, call_next):
        path = request.url.path
        # Limit only prompts-related public endpoints
        if path.startswith("/api/v1/prompts") or path.startswith("/api/v1/prompt-relations"):
            limiter.check(request)
        return await call_next(request)

    # Safely import router modules and include APIRouter instances when present.
    import importlib
    import pkgutil
    from fastapi import APIRouter

    pkg = importlib.import_module(f"{__package__}.api.routers")
    print(f"[factory] scanning routers in {pkg.__name__}")
    for finder, mod_name, ispkg in pkgutil.iter_modules(pkg.__path__):
        try:
            module = importlib.import_module(f"{pkg.__name__}.{mod_name}")
            print(f"[factory] imported module: {module.__name__}")
        except Exception as exc:  # pragma: no cover - import errors depend on runtime
            # print import errors to help debugging startup issues
            print(f"router import failed: {mod_name}: {exc}")
            continue
        # find APIRouter instances
        for attr_name in dir(module):
            try:
                attr = getattr(module, attr_name)
            except Exception:
                continue
            if isinstance(attr, APIRouter):
                try:
                    # include router; no fixed prefix here — routers define their own prefixes
                    app.include_router(attr, prefix="/api/v1")
                    print(f"[factory] included router from {module.__name__}.{attr_name}")
                except Exception as exc:  # pragma: no cover - inclusion may fail due to programmer error
                    print(f"include_router failed for {mod_name}.{attr_name}: {exc}")
                    continue

    @app.get("/")
    async def root() -> dict:
        return {"status": "ok"}

    # Provide explicit health endpoints to simplify checks from external tools
    @app.get("/healthz")
    async def root_health() -> dict:
        return {"status": "ok"}

    @app.get("/api/v1/healthz")
    async def api_v1_health() -> dict:
        return {"status": "ok"}

    # Log final routes on startup for diagnosis
    @app.on_event("startup")
    async def _log_routes() -> None:
        try:
            paths = sorted({r.path for r in app.routes})
            print("[factory] registered routes:\n" + "\n".join(paths))
        except Exception as exc:
            print(f"[factory] failed to list routes: {exc}")

    # DB init/close
    from .db import session as db_session

    @app.on_event("startup")
    async def _startup() -> None:  # pragma: no cover - integration tests should exercise
        await db_session.init_db(settings.database_url)

    @app.on_event("shutdown")
    async def _shutdown() -> None:  # pragma: no cover
        await db_session.close_db()

    return app


