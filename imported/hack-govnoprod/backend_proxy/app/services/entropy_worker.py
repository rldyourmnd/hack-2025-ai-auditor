from __future__ import annotations
import asyncio
import json
from pathlib import Path
from typing import Optional, List, Dict, Any

from .entropy_compute import compute_from_records, Weights as ComputeWeights
from .weights import get_weights
from ..db.session import get_session
from ..repositories.entropy import EntropyRepository


async def recompute_upload(upload_id: str, weights_version: Optional[str] = None, storage_root: str = "/tmp/entropy") -> None:
    """Background recompute: read parsed files from storage and recompute metrics, persist result.

    Non-blocking task; logs/errors are swallowed for now but could be instrumented.
    """
    base = Path(storage_root) / upload_id / "parsed"
    profiles_path = base / "profiles.jsonl"
    findings_path = base / "findings.jsonl"
    if not profiles_path.exists() or not findings_path.exists():
        return

    # load normalized records
    files: List[Dict[str, Any]] = []
    with profiles_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if not line.strip():
                continue
            files.append(json.loads(line))

    findings: List[Dict[str, Any]] = []
    with findings_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if not line.strip():
                continue
            findings.append(json.loads(line))

    w = get_weights(weights_version)
    comp_w = ComputeWeights(
        entropy_dimensions=w.entropy_dimensions,
        hpc_rules=w.hpc_rules,
        finding_kinds=w.finding_kinds,
        normalization=w.normalization,
    )

    res = compute_from_records(files, findings, comp_w)

    # persist via repository
    try:
        async with get_session() as session:
            repo = EntropyRepository(session)
            await repo.update_status(upload_id, "computing")
            await repo.save_result(upload_id, res, w.version)
            await repo.update_status(upload_id, "computed")
    except Exception:
        # DB may be down; we won't retry here — caller can requeue if needed
        return


