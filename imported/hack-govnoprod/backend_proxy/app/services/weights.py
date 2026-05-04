from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class Weights:
    version: str
    entropy_dimensions: Dict[str, float]
    hpc_rules: Dict[str, float]
    finding_kinds: Dict[str, float]
    normalization: Dict[str, str]
    notes: Optional[str] = None


# v1.0: initial heuristic weights. Values chosen to keep CDX within ~0..100 range
# under typical repo sizes. Adjust after calibration.
WEIGHTS_V1_0 = Weights(
    version="v1.0",
    entropy_dimensions={
        # ENUM-style axes (presence distribution across files)
        "http_client": 1.0,
        "logger": 0.8,
        "db_access": 1.2,
        "pydantic_version": 0.6,
        "json_lib": 0.6,
        "id_type": 0.7,
        "datetime_tz": 0.7,
        "pagination_style": 0.7,
        "typing_policy": 1.2,
        "concurrency_mode": 1.1,
        "config_style": 0.6,
        "logging_style": 0.6,
        "runtime_target": 0.5,
        "error_envelope": 0.5,
        "http_framework": 1.1,
        "orm_version": 1.0,
        # Q bucket axes (suffix _b denotes bucketized numeric metric)
        "imports_total_b": 0.8,
        "classes_count_b": 0.6,
        "functions_count_b": 0.6,
        "async_funcs_count_b": 0.5,
        "try_blocks_b": 0.6,
        "except_blocks_b": 0.6,
        "log_calls_b": 0.5,
        "print_calls_b": 0.7,
        "http_calls_b": 0.8,
        "yaml_unsafe_b": 1.0,
        "lines_code_b": 0.9,          # special buckets for LoC
        "avg_cyclomatic_b": 1.1,      # special buckets for complexity
    },
    hpc_rules={
        # Heuristic pattern checks — rates across files
        "large_file": 1.5,
        "many_todos": 0.6,
        "mixed_tabs_spaces": 0.4,
        "prints_in_code": 1.0,
        "missing_types": 1.3,
        "long_function": 1.1,
        "deep_nesting": 1.0,
        "broad_except": 1.2,
    },
    finding_kinds={
        # Static analysis findings normalized per KLoC (unless special-cased)
        "secret_hardcoded": 5.0,
        "import_cycle_small": 2.0,  # per 100 files normalization in compute
        "unused_variable": 0.6,
        "vuln_dependency": 1.6,
        "sql_injection_suspected": 3.0,
        "weak_hash": 1.2,
        "insecure_random": 1.0,
        "path_traversal": 2.2,
        "unsafe_yaml_load": 2.0,
        "ssrf_risk": 2.5,
        # Observed in sample findings
        "db_naming_mismatch": 1.2,
        "import_map": 0.5,
        "blocking_call_in_async": 1.3,
        # Generic buckets
        "db_quality": 1.0,
        "import_graph": 0.6,
        "async_misuse": 1.1,
        "other_finding": 0.2,
    },
    normalization={
        "findings": "per_kloc",
        "hpc": "rate",
        "entropy": "H_norm",
    },
    notes=(
        "Heuristic v1.0 weights across entropy dimensions (ENUM+Q), HPC rules, and findings. "
        "CDX = entropy + hpc + findings; CCI = max(0, 100 - CDX)."
    ),
)


_VERSIONS: Dict[str, Weights] = {
    WEIGHTS_V1_0.version: WEIGHTS_V1_0,
}


def get_weights(version: Optional[str] = None) -> Weights:
    """Return weights by version. Defaults to active v1.0."""
    v = version or "v1.0"
    try:
        return _VERSIONS[v]
    except KeyError:
        raise ValueError("Unknown weights version")


