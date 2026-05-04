// Q‑counters bucketization utilities
export type Bucket = 0|1|2|3|4|5|6; // 0,1,2-3,4-7,8-15,16-31,32+

const BUCKET_RANGES: Array<[number, number]> = [
  [0, 0],
  [1, 1],
  [2, 3],
  [4, 7],
  [8, 15],
  [16, 31],
  [32, Infinity]
];

export function bucketize(value: number): Bucket {
  if (value <= 0) return 0;
  for (let i = 0; i < BUCKET_RANGES.length; i++) {
    const [lo, hi] = BUCKET_RANGES[i];
    if (value >= lo && value <= hi) return i as Bucket;
  }
  return 6;
}

// LoC specific bucketization (log scale per spec)
export function bucketizeLines(lines: number): Bucket {
  if (lines <= 0) return 0;
  if (lines <= 99) return 1;
  if (lines <= 199) return 2;
  if (lines <= 399) return 3;
  if (lines <= 799) return 4;
  if (lines <= 1599) return 5;
  return 6;
}

// avg_cyclomatic bucketization surrogate
export function bucketizeCyclomatic(score: number): Bucket {
  if (score <= 0) return 0;
  if (score === 1) return 1;
  if (score <= 3) return 2;
  if (score <= 5) return 3;
  if (score <= 7) return 4;
  if (score <= 11) return 5;
  return 6;
}

// Convert raw lexical counts into Q counter buckets (select subset)
export function quantizeLexicalCounts(raw: Record<string, number>) {
  return {
    imports_total: bucketize(raw.imports || 0),
    classes_count: bucketize(raw.classes || 0),
    functions_count: bucketize(raw.funcs || 0),
    async_funcs_count: bucketize(raw.asyncFuncs || 0),
    try_blocks: bucketize(raw.tryBlocks || 0),
    except_blocks: bucketize(raw.exceptBlocks || 0),
    log_calls_count: bucketize(raw.logCalls || 0),
    print_calls_count: bucketize(raw.printCalls || 0),
    http_call_sites: bucketize(raw.httpCalls || 0),
    yaml_unsafe_count: bucketize(raw.yamlUnsafe || 0),
    lines_code: bucketizeLines(raw.lines || 0),
    avg_cyclomatic: bucketizeCyclomatic(raw.cyclomatic || 0)
  } as Record<string, Bucket>;
}

export default { bucketize, bucketizeLines, bucketizeCyclomatic, quantizeLexicalCounts };


