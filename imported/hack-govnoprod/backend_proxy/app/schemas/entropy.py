from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class AcceptedResponse(BaseModel):
    upload_id: UUID
    status: Literal[
        "accepted",
        "validating",
        "parsing_profiles",
        "parsing_findings",
        "computing",
        "computed",
        "failed",
    ]


class ProgressPart(BaseModel):
    read_lines: int = 0
    bad_lines: int = 0
    bytes_gz: int = 0


class StatusResponse(BaseModel):
    upload_id: UUID
    status: str
    progress: Optional[Dict[str, ProgressPart]] = None
    manifest: Optional[Dict[str, Any]] = None
    received_at: Optional[str] = None
    last_update_at: Optional[str] = None
    """Status response for an upload.

    - `status` can be one of: accepted, validating, parsing_profiles, parsing_findings, computing, computed, failed
    - `manifest` contains the uploaded manifest.json if available
    """


class ResultResponse(BaseModel):
    upload_id: UUID
    source: Optional[Dict[str, Any]]
    groups: Optional[List[str]]
    scores: Dict[str, float]
    decomposition: Optional[List[Dict[str, Any]]]
    by_group: Optional[Dict[str, Any]]
    weights_version: str
    provenance: Optional[Dict[str, Any]]


class ComputeRequest(BaseModel):
    files: List[Dict[str, Any]]
    findings: List[Dict[str, Any]] = []
    weights_version: Optional[str] = None


class ComputeResponse(BaseModel):
    weights_version: str
    groups: List[str]
    scores: Dict[str, float]
    decomposition: List[Dict[str, Any]]
    by_group: Dict[str, Any]
    provenance: Dict[str, Any]


class WeightsResponse(BaseModel):
    version: str
    entropy_dimensions: Dict[str, float]
    hpc_rules: Dict[str, float]
    finding_kinds: Dict[str, float]
    normalization: Dict[str, Any]
    notes: Optional[str] = None


class MultipartInitRequest(BaseModel):
    size: int = Field(..., ge=1)
    parts: int = Field(..., ge=1)
    sha256: str


class MultipartInitResponse(BaseModel):
    upload_id: UUID
    part_size: int


class MultipartPartResponse(BaseModel):
    received: int


class MultipartCompleteRequest(BaseModel):
    upload_id: UUID
    parts: List[Dict[str, Any]]


class MultipartCompleteResponse(BaseModel):
    upload_id: UUID
    status: Literal["accepted"]


