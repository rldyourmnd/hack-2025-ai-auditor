from __future__ import annotations

import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet

from ..config import Settings


def _derive_key_from_secret(secret: str) -> bytes:
    # Derive a 32-byte key and base64-url encode for Fernet
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def get_fernet(settings: Optional[Settings] = None) -> Fernet:
    settings = settings or Settings()
    master = settings.crypto_master_key or settings.jwt_secret or "dev-secret-change-me"
    key = _derive_key_from_secret(master)
    return Fernet(key)


def encrypt_secret(plaintext: str, settings: Optional[Settings] = None) -> str:
    f = get_fernet(settings)
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str, settings: Optional[Settings] = None) -> str:
    f = get_fernet(settings)
    return f.decrypt(token.encode("utf-8")).decode("utf-8")


