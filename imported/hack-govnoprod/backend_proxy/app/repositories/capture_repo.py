from __future__ import annotations

from ..repositories.base import GenericRepository
from ..models.orm.capture import CaptureEvent, CLIInvocation, IDEInstallation


class CaptureEventRepository(GenericRepository[CaptureEvent]):
    def __init__(self):
        super().__init__(CaptureEvent)


class CLIInvocationRepository(GenericRepository[CLIInvocation]):
    def __init__(self):
        super().__init__(CLIInvocation)


class IDEInstallationRepository(GenericRepository[IDEInstallation]):
    def __init__(self):
        super().__init__(IDEInstallation)


