import traceback

try:
    from backend_proxy.app.factory import create_app
    create_app()
    print("APP OK")
except Exception:
    traceback.print_exc()
