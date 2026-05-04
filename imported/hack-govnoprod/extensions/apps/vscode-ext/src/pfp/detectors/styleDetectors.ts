import * as fs from 'fs';

export async function detectStyleFromPath(p: string) {
  try {
    const src = await fs.promises.readFile(p, 'utf8');
    return detectStyleFromSource(src);
  } catch (e) {
    return {};
  }
}

export function detectStyleFromSource(src: string) {
  const blackCompatible = !/\t/.test(src); // naive
  const fstringUsed = /f"|'/.test(src);
  const oldFormatPct = /%\s*\(/.test(src);
  const docstringGoogle = /"""\s*@param\b|:param\b/.test(src);
  const complexityHigh = (src.match(/\bif\b|\bfor\b|\bwhile\b|\btry\b/g) || []).length > 50;
  return { blackCompatible, fstringUsed, oldFormatPct, docstringGoogle, complexityHigh };
}

export default { detectStyleFromPath, detectStyleFromSource };


