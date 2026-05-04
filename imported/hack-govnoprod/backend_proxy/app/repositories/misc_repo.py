from __future__ import annotations

from ..repositories.base import GenericRepository
from ..models.orm.misc import Tag, TagLink


class TagRepository(GenericRepository[Tag]):
    def __init__(self):
        super().__init__(Tag)


class TagLinkRepository(GenericRepository[TagLink]):
    def __init__(self):
        super().__init__(TagLink)


