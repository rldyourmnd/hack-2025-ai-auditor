from __future__ import annotations
from fastapi import APIRouter, Depends, Header, UploadFile, File, HTTPException, status, Request
import asyncio
import os
import logging
import tempfile
from pathlib import Path
from uuid import UUID
from ...security.auth import require_auth  # type: ignore
from ...schemas.entropy import (
    AcceptedResponse,
    StatusResponse,
    ResultResponse,
    WeightsResponse,
    ComputeRequest,
    ComputeResponse,
)
from ...services.weights import get_weights
from ...services.entropy_compute import compute_from_records, Weights as ComputeWeights
from ...services.entropy_ingest import ingest_entropy_zip
from ...db.session import get_session
from ...repositories.entropy import EntropyRepository
from ...utils.ttl_cache import TTLCache
from ...services.entropy_worker import recompute_upload


_cache = TTLCache(ttl_seconds=300)

router = APIRouter(prefix="/entropy", tags=["entropy"])


@router.post("/multipart/init", summary="Init multipart upload")
async def multipart_init(payload: dict, ctx=Depends(require_auth)):
    """Initialize multipart upload. Returns upload_id and recommended part_size."""
    import uuid
    upload_id = str(uuid.uuid4())
    return {"upload_id": upload_id, "part_size": 5 * 1024 * 1024}


@router.put("/multipart/part", summary="Upload a multipart part")
async def multipart_part(upload_id: str, part_no: int, file: UploadFile = File(...), ctx=Depends(require_auth)):
    """Upload a single part for multipart upload.

    Query args:
    - `upload_id`: multipart upload identifier
    - `part_no`: integer part number
    Body: binary part
    """
    base = Path(os.getenv("ENTROPY_MULTIPART_DIR", "/tmp/multipart")) / upload_id
    base.mkdir(parents=True, exist_ok=True)
    target = base / f"part_{part_no:04d}.bin"
    with target.open("wb") as fh:
        fh.write(await file.read())
    return {"received": target.stat().st_size}


@router.post("/multipart/complete", summary="Complete multipart upload")
async def multipart_complete(payload: dict, ctx=Depends(require_auth)):
    """Assemble uploaded parts into ZIP and trigger ingestion.

    Payload example:
    {
      "upload_id": "<uuid>",
      "parts": [{"no":1, "sha256":"..."}, ...]
    }
    """
    upload_id = payload.get("upload_id")
    parts = payload.get("parts", [])
    base = Path(os.getenv("ENTROPY_MULTIPART_DIR", "/tmp/multipart")) / upload_id
    assembled = base / "assembled.zip"
    with assembled.open("wb") as out:
        for p in sorted(parts, key=lambda x: x["no"]):
            part = base / f"part_{p['no']:04d}.bin"
            with part.open("rb") as fh:
                out.write(fh.read())

    # run ingestion on assembled file (synchronous for MVP)
    try:
        res = ingest_entropy_zip(str(assembled), upload_id=upload_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"error": {"code": "UNPROCESSABLE", "message": str(exc)}})

    # persist like /upload
    try:
        async with get_session() as session:
            repo = EntropyRepository(session)
            existing = await repo.get_upload(str(upload_id))
            if not existing:
                await repo.create_upload(str(upload_id), None)
            await repo.update_status(str(upload_id), "computed")
            await repo.save_result(str(upload_id), res, res.get("weights_version", "v1.0"))
    except Exception:
        _cache.set(f"entropy:{upload_id}", res)

    return {"upload_id": upload_id, "status": "computed"}


@router.post("/upload", status_code=202, response_model=AcceptedResponse)
async def upload(
    request: Request,
    file: UploadFile = File(None),
    x_upload_id: str = Header(..., alias="X-Upload-Id"),
    x_repo_id: str | None = Header(None, alias="X-Repo-Id"),
    ctx=Depends(require_auth),
):
    logger = logging.getLogger(__name__)
    try:
        upload_id = UUID(x_upload_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": {"code": "VALIDATION_ERROR", "message": "X-Upload-Id is not a valid UUID"}})

    # Accept either multipart/form-data (UploadFile) or raw application/zip body
    content = b''
    try:
        ct = request.headers.get('content-type','')
        if ct and ct.startswith('application/zip'):
            logger.debug('Upload: received raw application/zip body')
            content = await request.body()
        elif file is not None:
            content = await file.read()
        else:
            # fallback: try to read raw body anyway
            content = await request.body()
    except Exception as exc:
        logger.exception('Failed to read uploaded content')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": {"code": "READ_ERROR", "message": str(exc)}})
    """Upload zip archive (entropy-input-v1.zip) with headers:

    - `X-Upload-Id`: UUID (idempotency)
    - `X-Repo-Id`: optional repo identifier

    Body: `application/zip` containing `profiles.ndjson.gz`, `findings.ndjson.gz`, `manifest.json`.
    Returns 202 Accepted with `{upload_id, status}`.
    """

    # Always attempt compute so we can cache even if DB is down
    try:
        res = ingest_entropy_zip(content)
    except Exception as exc:
        # save problematic archive for debugging
        try:
            tf = tempfile.NamedTemporaryFile(delete=False, prefix='entropy-failed-', suffix='.zip')
            tf.write(content)
            tf.flush()
            tf.close()
            logging.getLogger(__name__).error(f'Ingest failed; saved archive to {tf.name}')
        except Exception:
            logging.getLogger(__name__).exception('Failed to save problematic archive')
        logging.getLogger(__name__).exception('Ingest error')
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"error": {"code": "UNPROCESSABLE", "message": str(exc), "saved_archive": tf.name if 'tf' in locals() else None}})

    # Try DB persistence, but don't fail request if DB down
    try:
        async with get_session() as session:
            repo = EntropyRepository(session)
            existing = await repo.get_upload(str(upload_id))
            if not existing:
                await repo.create_upload(str(upload_id), x_repo_id)
            await repo.update_status(str(upload_id), "computed")
            await repo.save_result(str(upload_id), res, res.get("weights_version", "v1.0"))
    except Exception:
        # DB down; keep last result in short-lived cache
        _cache.set(f"entropy:{upload_id}", res)

    return AcceptedResponse(upload_id=upload_id, status="computed")


@router.post("/upload/public", summary="Public upload (dev only)")
async def public_upload(request: Request, file: UploadFile = File(None)):
    """Public upload endpoint for quick tests/dev.

    Accepts a ZIP/.nzip file in form field `file`, ingests it synchronously
    and returns the computed entropy result. NO AUTH — intended for local/dev only.
    NOTE: This route is exposed under `/api/v1/entropy/upload/public` to match other
    routes' naming conventions (router prefix `/entropy` is included under `/api/v1`).
    """
    logger = logging.getLogger(__name__)
    # Accept raw application/zip or multipart/form-data
    try:
        ct = request.headers.get('content-type','')
        if ct and ct.startswith('application/zip'):
            content = await request.body()
        elif file is not None:
            content = await file.read()
        else:
            content = await request.body()
    except Exception as exc:
        logger.exception('Failed reading upload body')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": {"code": "READ_ERROR", "message": str(exc)}})

    try:
        res = ingest_entropy_zip(content)
    except Exception as exc:
        # save archive for debugging
        try:
            tf = tempfile.NamedTemporaryFile(delete=False, prefix='entropy-public-failed-', suffix='.zip')
            tf.write(content)
            tf.flush()
            tf.close()
            logger.error(f'Public ingest failed; saved archive to {tf.name}')
        except Exception:
            logger.exception('Failed to save problematic public archive')
        logger.exception('Public ingest error')
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"error": {"code": "UNPROCESSABLE", "message": str(exc), "saved_archive": tf.name if 'tf' in locals() else None}})

    # Return computed entropy and details directly. Do not persist in DB for public endpoint.
    scores = (res.get("details") or {}).get("scores", {})
    cdx = res.get("entropy") or scores.get("CDX")
    cci = scores.get("CCI")
    return {"entropy": cdx, "cci": cci, "weights_version": res.get("weights_version", "v1.0"), "details": res}


@router.get("/status/{upload_id}", response_model=StatusResponse)
async def status(upload_id: UUID, ctx=Depends(require_auth)):
    # Prefer DB; if not available, infer from cache
    try:
        async with get_session() as session:
            repo = EntropyRepository(session)
            u = await repo.get_upload(str(upload_id))
            if not u:
                cached = _cache.get(f"entropy:{upload_id}")
                if cached is None:
                    raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "upload not found"}})
                return StatusResponse(upload_id=upload_id, status="computed")
            return StatusResponse(upload_id=upload_id, status=u.status, manifest=u.manifest_json)
    except Exception:
        cached = _cache.get(f"entropy:{upload_id}")
        if cached is not None:
            return StatusResponse(upload_id=upload_id, status="computed")
        raise HTTPException(status_code=503, detail={"error": {"code": "UNAVAILABLE", "message": "status unavailable"}})


@router.get("/result/{upload_id}")
async def result(upload_id: UUID, ctx=Depends(require_auth)):
    # Prefer DB; fallback to cache
    try:
        async with get_session() as session:
            repo = EntropyRepository(session)
            u = await repo.get_upload(str(upload_id))
            if not u:
                cached = _cache.get(f"entropy:{upload_id}")
                if cached is None:
                    raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "upload not found"}})
                cdx = cached.get("details", {}).get("scores", {}).get("CDX") or cached.get("entropy")
                return {"upload_id": str(upload_id), "entropy": cdx, "details": cached.get("details", cached)}
            r = await repo.get_result(str(upload_id))
            if not r:
                return {"upload_id": str(upload_id), "status": u.status}
            cdx = r.result_json.get("scores", {}).get("CDX")
            return {"upload_id": str(upload_id), "entropy": cdx, "details": r.result_json}
    except Exception:
        cached = _cache.get(f"entropy:{upload_id}")
        if cached is not None:
            cdx = cached.get("details", {}).get("scores", {}).get("CDX") or cached.get("entropy")
            return {"upload_id": str(upload_id), "entropy": cdx, "details": cached.get("details", cached)}
        raise HTTPException(status_code=503, detail={"error": {"code": "UNAVAILABLE", "message": "result unavailable"}})


@router.get("/weights", response_model=WeightsResponse)
async def weights(ctx=Depends(require_auth)):
    w = get_weights()
    return WeightsResponse(
        version="v1.0",
        entropy_dimensions=w.entropy_dimensions,
        hpc_rules=w.hpc_rules,
        finding_kinds=w.finding_kinds,
        normalization=w.normalization,
        notes=w.notes,
    )


@router.post("/recompute/{upload_id}", status_code=202)
async def recompute(upload_id: UUID, weights_version: str | None = None, ctx=Depends(require_auth)):
    # enqueue background recompute (fire-and-forget)
    try:
        asyncio.create_task(recompute_upload(str(upload_id), weights_version))
    except Exception:
        raise HTTPException(status_code=500, detail={"error": {"code": "INTERNAL_ERROR", "message": "failed to schedule recompute"}})
    return {"upload_id": upload_id, "status": "recomputing"}


@router.post("/compute", response_model=ComputeResponse)
async def compute(payload: ComputeRequest, ctx=Depends(require_auth)):
    w = get_weights(payload.weights_version)
    comp_w = ComputeWeights(
        entropy_dimensions=w.entropy_dimensions,
        hpc_rules=w.hpc_rules,
        finding_kinds=w.finding_kinds,
        normalization=w.normalization,
    )
    res = compute_from_records(payload.files, payload.findings, comp_w)
    return ComputeResponse(weights_version=payload.weights_version or "v1.0", **res)

