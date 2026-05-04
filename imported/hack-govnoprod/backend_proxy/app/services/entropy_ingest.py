from __future__ import annotations
from typing import Any, Dict, Iterable, Optional
from uuid import UUID
import io
import json
import zipfile
import gzip

import logging
from .pfp_decoder import decode_pfp2
from .pfp_mapping import map_enums, map_q_buckets, map_hpc_mask
from .entropy_compute import compute_from_records, Weights as ComputeWeights
from .weights import get_weights
from .finding_mapping import normalize_finding_kind


def _top_level_folder(path: str) -> str:
    if not path or "/" not in path:
        return "."
    return path.split("/", 1)[0]


def _normalize_profile(rec: Dict[str, Any]) -> Dict[str, Any]:
    # Either pfp2 compact or expanded
    if isinstance(rec.get("pfp"), str) and rec["pfp"].startswith("pfp2:"):
        d = decode_pfp2(rec["pfp"])
        enums = map_enums(d.enums)
        q = map_q_buckets(d.q_buckets)
        hpc_hits = map_hpc_mask(d.hpc_mask)
        path = rec.get("path") or rec.get("file") or ""
        return {
            "path": path,
            "group": _top_level_folder(path),
            "enums": enums,
            "q": q,
            "hpc_hits": hpc_hits,
        }
    # assume expanded
    path = rec.get("path") or rec.get("file") or ""
    enums = rec.get("ENUMS") or rec.get("enums") or {}
    q = rec.get("Q") or rec.get("q") or {}
    hpc = rec.get("HPC") or rec.get("hpc_hits") or {}
    # Align to expected shapes
    if isinstance(q, dict):
        q = {k: int(v) for k, v in q.items()}
    return {
        "path": path,
        "group": _top_level_folder(path),
        "enums": enums,
        "q": q,
        "hpc_hits": hpc,
    }


def ingest_entropy_zip(content: bytes, weights_version: Optional[str] = None) -> Dict[str, Any]:
    zf = zipfile.ZipFile(io.BytesIO(content))
    names = set(zf.namelist())
    required = {"profiles.ndjson.gz", "findings.ndjson.gz", "manifest.json"}
    missing = required - names
    if missing:
        raise ValueError(f"zip missing: {', '.join(sorted(missing))}")

    # Read manifest
    with zf.open("manifest.json") as mf:
        manifest = json.loads(mf.read().decode("utf-8"))

    # Stream profiles (robust: skip malformed lines but collect samples)
    logger = logging.getLogger(__name__)
    files_norm = []
    bad_profiles = []
    with zf.open("profiles.ndjson.gz") as pf:
        with gzip.GzipFile(fileobj=pf) as gf:
            for idx, raw in enumerate(gf):
                try:
                    line = raw.decode("utf-8").strip()
                except Exception as exc:
                    logger.exception("Failed to decode profile line %s", idx)
                    if len(bad_profiles) < 5:
                        bad_profiles.append({'idx': idx, 'error': f'decode error: {str(exc)}'})
                    continue
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except Exception as exc:
                    logger.exception("Invalid JSON in profiles at line %s", idx)
                    if len(bad_profiles) < 5:
                        bad_profiles.append({'idx': idx, 'error': f'json error: {str(exc)}', 'line': line[:200]})
                    continue
                try:
                    files_norm.append(_normalize_profile(rec))
                except Exception as exc:
                    logger.exception("Failed to normalize profile at line %s", idx)
                    if len(bad_profiles) < 5:
                        bad_profiles.append({'idx': idx, 'error': f'normalize error: {str(exc)}', 'line': line[:200]})
                    continue

    # Stream findings (skip malformed entries but collect samples)
    findings_norm = []
    bad_findings = []
    with zf.open("findings.ndjson.gz") as ff:
        with gzip.GzipFile(fileobj=ff) as gf:
            for idx, raw in enumerate(gf):
                try:
                    line = raw.decode("utf-8").strip()
                except Exception as exc:
                    logger.exception("Failed to decode finding line %s", idx)
                    if len(bad_findings) < 5:
                        bad_findings.append({'idx': idx, 'error': f'decode error: {str(exc)}'})
                    continue
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except Exception as exc:
                    logger.exception("Invalid JSON in findings at line %s", idx)
                    if len(bad_findings) < 5:
                        bad_findings.append({'idx': idx, 'error': f'json error: {str(exc)}', 'line': line[:200]})
                    continue
                # normalize minimal shape
                try:
                    kind = rec.get("kind")
                except Exception:
                    kind = None
                if not kind:
                    if len(bad_findings) < 5:
                        bad_findings.append({'idx': idx, 'error': 'missing kind', 'line': line[:200]})
                    continue
                fpath = rec.get("file")
                grp = _top_level_folder(fpath) if fpath else "."
                try:
                    findings_norm.append({"kind": normalize_finding_kind(kind), "group": grp})
                except Exception as exc:
                    logger.exception("Failed to normalize finding at line %s", idx)
                    if len(bad_findings) < 5:
                        bad_findings.append({'idx': idx, 'error': f'normalize error: {str(exc)}', 'line': line[:200]})
                    continue

    # Soft-skip strategy: if some profiles parsed ok, continue but log counts and samples; if none valid, raise.
    if not files_norm:
        msg = f'No valid profiles after parsing; skipped_profiles={len(bad_profiles)}; samples={bad_profiles}'
        logger.error(msg)
        raise ValueError(msg)
    else:
        if bad_profiles:
            logger.warning(f'Parsed {len(files_norm)} profiles, skipped {len(bad_profiles)} malformed profiles; samples={bad_profiles}')

    w = get_weights(weights_version)
    comp_w = ComputeWeights(
        entropy_dimensions=w.entropy_dimensions,
        hpc_rules=w.hpc_rules,
        finding_kinds=w.finding_kinds,
        normalization=w.normalization,
    )
    res = compute_from_records(files_norm, findings_norm, comp_w)
    # Return entropy (CDX) not CCI
    entropy = res["scores"]["CDX"]
    return {
        "weights_version": w.version,
        "entropy": entropy,
        "details": res,
        "manifest": manifest,
    }


