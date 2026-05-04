from __future__ import annotations
from typing import Optional
from sqlmodel import select
from ..models.orm.entropy import EntropyUpload, EntropyResult, EntropyProgress


class EntropyRepository:
    def __init__(self, session) -> None:
        self.session = session

    async def create_upload(self, upload_id: str, repo_id: Optional[str]) -> EntropyUpload:
        obj = EntropyUpload(id=upload_id, repo_id=repo_id)
        self.session.add(obj)
        await self.session.commit()
        await self.session.refresh(obj)
        return obj

    async def get_upload(self, upload_id: str) -> Optional[EntropyUpload]:
        q = select(EntropyUpload).where(EntropyUpload.id == upload_id)
        res = await self.session.exec(q)
        return res.one_or_none()

    async def update_status(self, upload_id: str, status: str) -> None:
        obj = await self.get_upload(upload_id)
        if obj:
            obj.status = status
            await self.session.commit()

    async def upsert_progress(self, upload_id: str, **kwargs) -> None:
        q = select(EntropyProgress).where(EntropyProgress.upload_id == upload_id)
        res = await self.session.exec(q)
        p = res.one_or_none()
        if p is None:
            p = EntropyProgress(upload_id=upload_id, **kwargs)
            self.session.add(p)
        else:
            for k, v in kwargs.items():
                setattr(p, k, v)
        await self.session.commit()

    async def save_result(self, upload_id: str, result_json: dict, weights_version: str) -> None:
        # upsert result
        q = select(EntropyResult).where(EntropyResult.upload_id == upload_id)
        res = await self.session.exec(q)
        r = res.one_or_none()
        if r is None:
            r = EntropyResult(upload_id=upload_id, result_json=result_json, weights_version=weights_version)
            self.session.add(r)
        else:
            r.result_json = result_json
            r.weights_version = weights_version
        await self.session.commit()

    async def get_result(self, upload_id: str) -> Optional[EntropyResult]:
        q = select(EntropyResult).where(EntropyResult.upload_id == upload_id)
        res = await self.session.exec(q)
        return res.one_or_none()


