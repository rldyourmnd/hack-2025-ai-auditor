from __future__ import annotations

from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel


class AnalysisRunRead(BaseModel):
    id: Optional[str]
    project_id: str
    user_id: Optional[str]
    status: str
    started_at: datetime
    finished_at: Optional[datetime]
    meta: dict

    class Config:
        orm_mode = True


class AnalysisMetricRead(BaseModel):
    id: Optional[str]
    analysis_run_id: str
    key: str
    value_num: Optional[float]
    value_text: Optional[str]
    value_json: Optional[dict]
    created_at: datetime

    class Config:
        orm_mode = True


