import { parseFileForRole } from '../astParser';

export async function detectPathRole(filePath: string) {
  const r = await parseFileForRole(filePath);
  // map roleTags -> plane bits (placeholder: return list)
  return { roleTags: r.roleTags, main_guard: r.mainGuard };
}

export default { detectPathRole };


