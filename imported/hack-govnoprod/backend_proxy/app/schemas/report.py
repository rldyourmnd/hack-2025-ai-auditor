from __future__ import annotations

from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel


class AnalysisReportRead(BaseModel):
    id: Optional[str]
    original_prompt: str
    analyzed_at: datetime
    detected_language: str
    translated: bool
    format_valid: bool
    judge_score: float
    judge_rationale: str
    judge_details: Optional[dict]
    entropy: float
    spread: float
    clusters: int
    samples: List[str]
    length_chars: int
    length_words: int
    complexity_score: float
    overall_score: float
    improvement_priority: str

    class Config:
        orm_mode = True


class AnalysisPatchRead(BaseModel):
    id: Optional[str]
    report_id: str
    type: str
    category: str
    description: str
    original: str
    improved: str
    rationale: str
    confidence: float

    class Config:
        orm_mode = True


