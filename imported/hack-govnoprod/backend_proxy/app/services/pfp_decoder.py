from __future__ import annotations
from dataclasses import dataclass
import base64
from typing import List, Optional
import base64
import logging


@dataclass
class PfpHeader:
    schema_id: int
    flags: int
    tier: int


@dataclass
class PfpDecoded:
    header: PfpHeader
    core_planes: List[int]
    hpc_mask: int
    q_buckets: List[int]
    enums: List[int]
    simhash64: Optional[int]
    pathhash24: Optional[int]
    crc8: Optional[int]


def _read_bits(buf: bytes, bit_offset: int, bit_len: int) -> int:
    val = 0
    for i in range(bit_len):
        byte_index = (bit_offset + i) // 8
        bit_index = (bit_offset + i) % 8
        bit = (buf[byte_index] >> bit_index) & 1
        val |= (bit << i)
    return val


def decode_pfp2(pfp2_str: str) -> PfpDecoded:
    if not pfp2_str.startswith("pfp2:"):
        raise ValueError("bad prefix")
    payload = pfp2_str[5:]
    logger = logging.getLogger(__name__)
    # Try fast path: ASCII bytes
    try:
        data = base64.a85decode(payload.encode("ascii"), adobe=False)
    except UnicodeEncodeError as exc:
        # Attempt to sanitize payload by stripping non-Ascii85 characters,
        # but preserve 'z' (zero-quad shorthand in Ascii85)
        sanitized = "".join(ch for ch in payload if (33 <= ord(ch) <= 117) or ch == 'z')
        if not sanitized:
            raise ValueError(f"pfp2 payload contains non-ascii characters: {str(exc)}")
        try:
            data = base64.a85decode(sanitized.encode("ascii"), adobe=False)
            logger.warning("pfp2 payload contained non-ascii characters; sanitized before decode")
        except Exception as exc2:
            raise ValueError(f"failed to base85-decode pfp2 payload after sanitization: {str(exc2)}")
    except Exception as exc:
        # Bubble up decode errors with context
        raise ValueError(f"failed to base85-decode pfp2 payload: {str(exc)}")
    # validate decoded length to avoid IndexError in bit reads
    bit = 0
    min_bytes = 75  # expected minimum bytes for full pfp2 payload (600 bits)
    if len(data) < min_bytes:
        raise ValueError(f"pfp2 payload too short: {len(data)} bytes")
    header_raw = _read_bits(data, bit, 32)
    bit += 32
    schema_id = (header_raw >> 20) & 0xFFF
    flags = (header_raw >> 8) & 0xFFF
    tier = header_raw & 0xF
    header = PfpHeader(schema_id=schema_id, flags=flags, tier=tier)
    core_planes: List[int] = []
    for _ in range(4):
        core_planes.append(_read_bits(data, bit, 64))
        bit += 64
    hpc_mask = _read_bits(data, bit, 64)
    bit += 64
    q_buckets: List[int] = []
    for i in range(24):
        q_buckets.append(_read_bits(data, bit + i * 3, 3))
    bit += 72
    enums: List[int] = []
    for i in range(16):
        enums.append(_read_bits(data, bit + i * 5, 5))
    bit += 80
    simhash64 = _read_bits(data, bit, 64)
    bit += 64
    pathhash24 = _read_bits(data, bit, 24)
    bit += 24
    crc8 = _read_bits(data, bit, 8)
    bit += 8
    return PfpDecoded(header, core_planes, hpc_mask, q_buckets, enums, simhash64, pathhash24, crc8)


