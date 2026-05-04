from __future__ import annotations
from typing import Any, Dict, Optional
import time


class TTLCache:
    def __init__(self, ttl_seconds: int = 300) -> None:
        self._ttl = ttl_seconds
        self._data: Dict[str, tuple[float, Any]] = {}

    def set(self, key: str, value: Any) -> None:
        self._data[key] = (time.time() + self._ttl, value)

    def get(self, key: str) -> Optional[Any]:
        item = self._data.get(key)
        if not item:
            return None
        expires_at, value = item
        if time.time() > expires_at:
            self._data.pop(key, None)
            return None
        return value

    def delete(self, key: str) -> None:
        self._data.pop(key, None)


