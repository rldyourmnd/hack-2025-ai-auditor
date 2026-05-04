from __future__ import annotations

from ..repositories.base import GenericRepository
from ..models.orm.report import AnalysisReport, AnalysisContradiction, AnalysisPatch, AnalysisClarifyQuestion


class AnalysisReportRepository(GenericRepository[AnalysisReport]):
    def __init__(self):
        super().__init__(AnalysisReport)


class AnalysisContradictionRepository(GenericRepository[AnalysisContradiction]):
    def __init__(self):
        super().__init__(AnalysisContradiction)


class AnalysisPatchRepository(GenericRepository[AnalysisPatch]):
    def __init__(self):
        super().__init__(AnalysisPatch)


class AnalysisClarifyQuestionRepository(GenericRepository[AnalysisClarifyQuestion]):
    def __init__(self):
        super().__init__(AnalysisClarifyQuestion)


