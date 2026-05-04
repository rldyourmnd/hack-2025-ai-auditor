// HPC (Contradiction Parity) computation for HAF-PFP v2.3
// Simple implementation: rules are hard-coded to match mapping_v23.yaml subset

export type Features = Record<string, boolean | number>;

export function computeHpc(features: Features, policyFlags?: Record<string, boolean>): bigint {
  // Each rule sets a bit index when condition is true
  let mask = 0n;

  const f = (k: string) => Boolean(features[k]);
  const p = (k: string) => Boolean(policyFlags && policyFlags[k]);

  // rule 0: asyncio ⊕ http_requests_sync
  if (f('asyncio') !== f('http_requests_sync')) mask |= 1n << 0n;

  // rule 1: asyncio ⊕ time_sleep_many
  if (f('asyncio') !== f('time_sleep_many')) mask |= 1n << 1n;

  // rule 2: datetime_tz_aware ⊕ datetime_naive
  if (f('datetime_tz_aware') !== f('datetime_naive')) mask |= 1n << 2n;

  // rule 3: pathlib_used ⊕ os_path_used
  if (f('pathlib_used') !== f('os_path_used')) mask |= 1n << 3n;

  // rule 4: logging_used ⊕ print_used_for_logs
  if (f('logging_used') !== f('print_used_for_logs')) mask |= 1n << 4n;

  // rule 5: pydantic_v2 ⊕ pydantic_v1
  if (f('pydantic_v2') !== f('pydantic_v1')) mask |= 1n << 5n;

  // rule 6: http_calls_present ⊕ http_explicit_timeout (we treat explicit timeout false as conflict)
  if (f('http_calls_present') && !f('http_explicit_timeout')) mask |= 1n << 6n;

  // rule 7: sqlmodel_exec_used ⊕ sqlalchemy_asyncsession_used
  if (f('sqlmodel_exec_used') && f('sqlalchemy_asyncsession_used')) mask |= 1n << 7n;

  // rule 8: yaml_load_unsafe ⊕ policy_yaml_safe_only
  if (f('yaml_load_unsafe') && p('policy_yaml_safe_only')) mask |= 1n << 8n;

  // rule 9: pickle_or_marshal ⊕ policy_no_pickle
  if (f('pickle_or_marshal') && p('policy_no_pickle')) mask |= 1n << 9n;

  // rule 10: except_bare ⊕ policy_no_bare_except
  if (f('except_bare') && p('policy_no_bare_except')) mask |= 1n << 10n;

  // rule 11: relative_imports_heavy ⊕ policy_absolute_imports
  if (f('relative_imports_heavy') && p('policy_absolute_imports')) mask |= 1n << 11n;

  // rule 12: cfg_ns_fp16 ⊕ repo_cfg_ns_fp16 (unequal -> conflict)
  if (features['cfg_ns_fp16'] && features['repo_cfg_ns_fp16'] && features['cfg_ns_fp16'] !== features['repo_cfg_ns_fp16']) mask |= 1n << 12n;

  // rule 13: runtime_pip_install ⊕ policy_quality_strict
  if (f('runtime_pip_install') && p('policy_quality_strict')) mask |= 1n << 13n;

  // rule 14: platform_branching ⊕ !opentelemetry_used (platform branching present but otel missing)
  if (f('platform_branching') && !f('opentelemetry_used')) mask |= 1n << 14n;

  return mask;
}

export function hpcToBinaryString(mask: bigint): string {
  const bits: string[] = [];
  for (let i = 0; i < 64; i++) bits.push(((mask >> BigInt(i)) & 1n) ? '1' : '0');
  return bits.reverse().join('');
}

export default { computeHpc, hpcToBinaryString };


