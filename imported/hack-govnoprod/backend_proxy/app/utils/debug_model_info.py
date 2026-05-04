import inspect
import traceback

try:
    from backend_proxy.app.models.orm.users import Prompt
    print('Prompt annotations:')
    for k, v in getattr(Prompt, '__annotations__', {}).items():
        print(k, '->', v, type(v))

    print('\nPrompt model_fields if any:')
    # Pydantic v2 uses `model_fields`; keep fallback to `__fields__` for older versions
    fields = getattr(Prompt, 'model_fields', getattr(Prompt, '__fields__', None))
    print(fields)
except Exception:
    traceback.print_exc()


