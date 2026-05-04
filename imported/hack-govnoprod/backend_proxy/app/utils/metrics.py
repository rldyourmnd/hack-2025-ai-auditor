from __future__ import annotations

import time
from typing import Callable

from fastapi import Request, Response


class RequestTimer:
    def __init__(self) -> None:
        self._start = time.perf_counter()

    def ms(self) -> int:
        return int((time.perf_counter() - self._start) * 1000)


async def record_basic_metrics(request: Request, call_next: Callable[[Request], Response]) -> Response:
    timer = RequestTimer()
    response = await call_next(request)
    # Placeholders: integrate with real metrics backend later
    try:
        path = request.url.path
        method = request.method
        status = response.status_code
        duration_ms = timer.ms()
        # You can hook this into Prometheus or logs; for now it's a no-op function
        _ = (path, method, status, duration_ms)
    except Exception:
        pass
    return response


