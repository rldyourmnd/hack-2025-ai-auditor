from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    prompt_id: Optional[str] = None
    inline_prompt: Optional[str] = None
    model: Optional[str] = None
    options: dict = {}


class AnalyzeResponse(BaseModel):
    report: dict
    patches: list[dict]
    questions: list[dict]


class AnalyzeApplyRequest(BaseModel):
    prompt_id: Optional[str] = None
    inline_prompt: Optional[str] = None
    patches: list[dict]


class AnalyzeApplyResponse(BaseModel):
    improved_prompt: str
    applied_patches: list[dict]
    quality_gain: float


class AnalyzeClarifyRequest(BaseModel):
    question_id: Optional[str] = None
    answers: dict


class AnalyzeClarifyResponse(BaseModel):
    report: dict
    patches: list[dict]
    questions: list[dict]


