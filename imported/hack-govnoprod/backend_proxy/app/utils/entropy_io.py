from __future__ import annotations
from typing import BinaryIO, Iterator, Dict, Any
import zipfile
import gzip
import io
import json


def iter_zip_members(zip_bytes: BinaryIO) -> Iterator[str]:
    with zipfile.ZipFile(zip_bytes) as zf:
        for name in zf.namelist():
            yield name


def open_zip_member(zip_bytes: BinaryIO, member_name: str) -> BinaryIO:
    zf = zipfile.ZipFile(zip_bytes)
    return zf.open(member_name)


def iter_gzip_ndjson(fileobj: BinaryIO, max_line_bytes: int = 1024 * 1024) -> Iterator[Dict[str, Any]]:
    # fileobj is gzip-compressed bytes stream
    with gzip.GzipFile(fileobj=fileobj) as gf:
        for raw in gf:
            if len(raw) > max_line_bytes:
                raise ValueError("line too long")
            line = raw.decode("utf-8").strip()
            if not line:
                continue
            yield json.loads(line)


