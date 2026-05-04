from __future__ import annotations

from ..repositories.base import GenericRepository
from ..models.orm.judge import JudgeRubric, JudgeCriterion, JudgeScore


class JudgeRubricRepository(GenericRepository[JudgeRubric]):
    def __init__(self):
        super().__init__(JudgeRubric)


class JudgeCriterionRepository(GenericRepository[JudgeCriterion]):
    def __init__(self):
        super().__init__(JudgeCriterion)


class JudgeScoreRepository(GenericRepository[JudgeScore]):
    def __init__(self):
        super().__init__(JudgeScore)


