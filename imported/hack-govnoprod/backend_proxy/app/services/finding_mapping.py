from __future__ import annotations


# Canonicalize/normalize client finding kinds to server weights keys
ALIASES = {
    "db_naming_mismatch": "db_naming_mismatch",
    "import_map": "import_map",
    "blocking_call_in_async": "blocking_call_in_async",
}


def normalize_finding_kind(kind: str) -> str:
    k = kind.strip().lower()
    return ALIASES.get(k, k)


