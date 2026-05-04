from __future__ import annotations
from typing import Dict, List


# mapping_v23: index-based mapping for enums, q buckets and hpc bit names
# For MVP we embed a compact mapping; extend to full mapping later or load from YAML.

ENUM_DIMENSIONS: List[str] = [
    "http_client",
    "logger",
    "db_access",
    "pydantic_version",
    "json_lib",
    "id_type",
    "datetime_tz",
    "pagination_style",
    "typing_policy",
    "concurrency_mode",
    "config_style",
    "logging_style",
    "runtime_target",
    "error_envelope",
    "http_framework",
    "orm_version",
]

Q_DIMENSIONS: List[str] = [
    "imports_total",
    "classes_count",
    "functions_count",
    "async_funcs_count",
    "try_blocks",
    "except_blocks",
    "log_calls_count",
    "print_calls_count",
    "http_call_sites",
    "yaml_unsafe_count",
    "lines_code",
    "avg_cyclomatic",
    # pad to 24 entries to match pfp2 layout
    "q13",
    "q14",
    "q15",
    "q16",
    "q17",
    "q18",
    "q19",
    "q20",
    "q21",
    "q22",
    "q23",
    "q24",
]

HPC_RULES: List[str] = [
    "large_file",
    "many_todos",
    "mixed_tabs_spaces",
    "prints_in_code",
    "missing_types",
    "long_function",
    "deep_nesting",
    "broad_except",
]

# Expand to 64 slots
while len(HPC_RULES) < 64:
    HPC_RULES.append(f"unknown_rule_{len(HPC_RULES)}")


def map_enums(enum_values: List[int]) -> Dict[str, int]:
    res: Dict[str, int] = {}
    for i, name in enumerate(ENUM_DIMENSIONS):
        if i < len(enum_values):
            res[name] = enum_values[i]
    return res


def map_q_buckets(q_buckets: List[int]) -> Dict[str, int]:
    res: Dict[str, int] = {}
    for i, name in enumerate(Q_DIMENSIONS):
        if i < len(q_buckets):
            res[name] = q_buckets[i]
    return res


def map_hpc_mask(hpc_mask: int) -> Dict[str, bool]:
    res: Dict[str, bool] = {}
    for i in range(64):
        hit = (hpc_mask >> i) & 1 == 1
        if not hit:
            continue
        if i < len(HPC_RULES):
            name = HPC_RULES[i]
        else:
            name = f"unknown_rule_{i}"
        res[name] = True
    return res


