from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Tuple, Any, Iterable
import math
from collections import Counter, defaultdict


@dataclass
class Weights:
    entropy_dimensions: Dict[str, float]
    hpc_rules: Dict[str, float]
    finding_kinds: Dict[str, float]
    normalization: Dict[str, str]


def shannon_H_norm(counts: Dict[str, int]) -> tuple[float, float]:
    total = sum(counts.values())
    if total <= 0:
        return 0.0, 0.0
    probs = [c / total for c in counts.values() if c > 0]
    m = len(probs)
    if m <= 1:
        return 0.0, 0.0
    H = -sum(p * math.log2(p) for p in probs)
    Hn = H / math.log2(m)
    return H, Hn


def coverage(defined: int, total_files: int) -> float:
    return (defined / total_files) if total_files else 0.0


def kloc_est_from_buckets(lines_buckets: Iterable[int]) -> float:
    centers = [0, 50, 150, 300, 600, 1200, 2000]
    return sum(centers[b] for b in lines_buckets) / 1000.0


def normalize_findings(kind: str, count: int, kloc: float, n_files: int) -> float:
    if kind == "import_cycle_small":
        denom = max(n_files / 100.0, 1e-9)
        return count / denom
    return count / max(kloc, 1e-9)


def normalize_hpc(rule: str, hits: int, n_files: int) -> float:
    return hits / max(n_files, 1e-9)


def compute_entropy_terms(
    per_file_enums: Dict[str, Dict[str, str]],
    per_file_q: Dict[str, Dict[str, int]],
    weights: Weights,
    n_files: int,
) -> tuple[float, list[dict]]:
    contribs: list[dict] = []
    total = 0.0
    for dim, w in weights.entropy_dimensions.items():
        if dim.endswith("_b"):
            q_key = dim[:-2]
            values = [str(q.get(q_key)) for q in per_file_q.values() if q_key in q]
            defined = sum(1 for v in values if v is not None)
            counts = Counter(v for v in values if v is not None)
        else:
            values = [enums.get(dim) for enums in per_file_enums.values() if dim in enums]
            defined = sum(1 for v in values if v is not None)
            counts = Counter(v for v in values if v is not None)
        _, Hn = shannon_H_norm(counts)
        cov = coverage(defined, n_files)
        term = w * Hn * cov
        total += term
        contribs.append({"type": "entropy", "name": dim, "H_norm": Hn, "coverage": cov, "w": w, "contrib": term})
    return total, contribs


def compute_hpc_term(
    per_file_hpc_hits: List[Dict[str, bool]],
    weights: Weights,
    n_files: int,
) -> tuple[float, list[dict]]:
    counts: Counter[str] = Counter()
    for d in per_file_hpc_hits:
        for rule, hit in d.items():
            if hit:
                counts[rule] += 1
    contribs: list[dict] = []
    total = 0.0
    for rule, w in weights.hpc_rules.items():
        rate = normalize_hpc(rule, counts.get(rule, 0), n_files)
        term = w * rate
        total += term
        contribs.append({"type": "hpc", "rule": rule, "rate": rate, "w": w, "contrib": term})
    return total, contribs


def compute_findings_term(
    findings_by_kind: Dict[str, int],
    weights: Weights,
    kloc: float,
    n_files: int,
) -> tuple[float, list[dict]]:
    contribs: list[dict] = []
    total = 0.0
    for k, w in weights.finding_kinds.items():
        val = normalize_findings(k, findings_by_kind.get(k, 0), kloc, n_files)
        term = w * val
        total += term
        contribs.append({"type": "finding", "kind": k, "count": findings_by_kind.get(k, 0), "norm": "per_kloc", "w": w, "contrib": term})
    return total, contribs


def compute_cdx_cci(entropy_term: float, hpc_term: float, findings_term: float) -> dict:
    cdx = entropy_term + hpc_term + findings_term
    cci = max(0.0, 100.0 - cdx)
    return {"CDX": cdx, "CCI": cci}


def compute_from_records(files: List[Dict[str, Any]], findings: List[Dict[str, Any]], weights: Weights) -> dict:
    # Build per-file maps
    per_file_enums: Dict[str, Dict[str, str]] = {}
    per_file_q: Dict[str, Dict[str, int]] = {}
    per_file_hpc_hits: List[Dict[str, bool]] = []
    lines_buckets: List[int] = []
    group_by_file: Dict[str, str] = {}

    for rec in files:
        path = rec.get("path") or rec.get("file") or f"file_{len(per_file_q)}"
        per_file_enums[path] = rec.get("enums", {})
        per_file_q[path] = rec.get("q", {})
        per_file_hpc_hits.append(rec.get("hpc_hits", {}))
        lb = rec.get("q", {}).get("lines_code", 0)
        try:
            lines_buckets.append(int(lb))
        except Exception:
            lines_buckets.append(0)
        group_by_file[path] = rec.get("group") or "."

    n_files = len(per_file_q)
    kloc = kloc_est_from_buckets(lines_buckets)

    # Aggregate findings by kind (global)
    findings_by_kind: Dict[str, int] = Counter()
    for f in findings:
        kind = f.get("kind")
        if not kind:
            continue
        findings_by_kind[kind] += 1

    # Compute global terms
    e_total, e_contribs = compute_entropy_terms(per_file_enums, per_file_q, weights, n_files)
    h_total, h_contribs = compute_hpc_term(per_file_hpc_hits, weights, n_files)
    f_total, f_contribs = compute_findings_term(findings_by_kind, weights, kloc, n_files)
    scores = compute_cdx_cci(e_total, h_total, f_total)

    # By-group computation
    files_by_group: Dict[str, list[str]] = defaultdict(list)
    for path, grp in group_by_file.items():
        files_by_group[grp].append(path)

    by_group: Dict[str, Any] = {}
    for grp, files_in_group in files_by_group.items():
        n = len(files_in_group)
        if n == 0:
            continue
        sub_enums = {p: per_file_enums[p] for p in files_in_group if p in per_file_enums}
        sub_q = {p: per_file_q[p] for p in files_in_group if p in per_file_q}
        sub_hpc_hits = []
        for p in files_in_group:
            idx = list(per_file_q.keys()).index(p) if p in per_file_q else -1
            if 0 <= idx < len(per_file_hpc_hits):
                sub_hpc_hits.append(per_file_hpc_hits[idx])
        sub_lines = []
        for p in files_in_group:
            lb = per_file_q.get(p, {}).get("lines_code", 0)
            try:
                sub_lines.append(int(lb))
            except Exception:
                sub_lines.append(0)

        sub_kloc = kloc_est_from_buckets(sub_lines)
        sub_findings = Counter()
        for f in findings:
            f_grp = f.get("group") or "."
            if f_grp == grp:
                kind = f.get("kind")
                if kind:
                    sub_findings[kind] += 1

        se, se_c = compute_entropy_terms(sub_enums, sub_q, weights, n)
        sh, sh_c = compute_hpc_term(sub_hpc_hits, weights, n)
        sf, sf_c = compute_findings_term(sub_findings, weights, sub_kloc, n)
        by_group[grp] = {
            "scores": compute_cdx_cci(se, sh, sf),
            "entropy": se_c,
            "hpc": sh_c,
            "findings": sf_c,
        }

    decomposition = e_contribs + h_contribs + f_contribs
    groups = sorted(by_group.keys())
    provenance = {"n_files": n_files, "kloc": kloc}

    return {
        "groups": groups,
        "scores": scores,
        "decomposition": decomposition,
        "by_group": by_group,
        "provenance": provenance,
    }


