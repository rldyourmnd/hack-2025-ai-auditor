// Minimal worker pool scaffold (uses simple concurrency with Promise.all batches)
export async function runBatches<T, R>(items: T[], batchSize: number, fn: (it: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const res = await Promise.all(slice.map(fn));
    out.push(...res);
  }
  return out;
}

export default {};


