from backend_proxy.app.factory import create_app


def test_create_app():
    app = create_app()
    assert app is not None
    # router included
    routes = [r.path for r in app.routes]
    assert "/api/v1/public/healthz" in routes or "/api/v1/public/healthz/" in routes


