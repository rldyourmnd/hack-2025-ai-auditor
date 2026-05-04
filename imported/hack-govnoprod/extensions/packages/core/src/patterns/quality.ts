/**
 * Anchor: inline-quality-patterns
 * Lightweight, local-only patterns to detect ambiguous or risky fragments
 * inside a prompt for inline highlighting. Designed for runtime use in the
 * browser content script (no external deps, pure string/regex).
 */

export type InlineSeverity = 'low' | 'medium' | 'high';

export interface InlinePatternMatch {
  id: string;
  message: string;
  severity: InlineSeverity;
  start: number; // inclusive UTF-16 index in the source string
  end: number;   // exclusive UTF-16 index in the source string
}

interface RegexRule {
  id: string;
  message: string;
  severity: InlineSeverity;
  re: RegExp; // MUST be global to collect all matches
}

// Keep patterns minimal and language-agnostic; aim to catch common issues
// without being too noisy. PII patterns are duplicated here for inline
// visual hints and should be consistent with detectors.
const RULES: RegexRule[] = [
  {
    id: 'amb-quick',
    message: 'Ambiguous time qualifier',
    severity: 'medium',
    re: /\b(quickly|asap|soon|fast|immediately)\b/gi,
  },
  {
    id: 'amb-vague',
    message: 'Vague qualifier',
    severity: 'low',
    re: /\b(simple|easily|obvious|clearly)\b/gi,
  },
  {
    id: 'amb-pronoun',
    message: 'Vague reference (consider specifying what “it/this/that” refers to)',
    severity: 'low',
    re: /\b(?:do it|fix it|improve it|make it (?:better|faster|cleaner)|this (?:thing|part|one)|that (?:thing|part|one))\b/gi,
  },
  {
    id: 'pii-email',
    message: 'Email-like pattern',
    severity: 'high',
    re: /[\w.-]+@[\w.-]+\.[A-Za-z]{2,6}/g,
  },
  {
    id: 'pii-phone',
    message: 'Phone-like pattern',
    severity: 'high',
    re: /(?:\+\d{1,3}[ -]?)?\d{10,14}/g,
  },
  {
    id: 'secrets',
    message: 'Possible secret or token mention',
    severity: 'high',
    re: /\b(api[_-]?key|secret|password|token)\b/gi,
  },
];

/**
 * Run inline quality patterns on a given text and return ranges to highlight.
 * Implementation is conservative to avoid excessive noise.
 */
export function runQualityPatterns(text: string): InlinePatternMatch[] {
  const matches: InlinePatternMatch[] = [];
  if (!text) return matches;

  for (const rule of RULES) {
    rule.re.lastIndex = 0; // ensure start from 0
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(text))) {
      const idx = m.index;
      const len = m[0]?.length ?? 0;
      if (len <= 0) {
        // guard against zero-length matches
        rule.re.lastIndex = (rule.re.lastIndex || 0) + 1;
        continue;
      }
      matches.push({
        id: rule.id,
        message: rule.message,
        severity: rule.severity,
        start: idx,
        end: idx + len,
      });
    }
  }

  // Optional: de-duplicate overlapping matches preferring higher severity
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const dedup: InlinePatternMatch[] = [];
  for (const m of matches) {
    const last = dedup[dedup.length - 1];
    if (!last) { dedup.push(m); continue; }
    const overlaps = !(m.end <= last.start || m.start >= last.end);
    if (!overlaps) { dedup.push(m); continue; }
    // If overlaps, keep the one with higher severity, otherwise keep the longer
    const rank = (s: InlineSeverity) => (s === 'high' ? 3 : s === 'medium' ? 2 : 1);
    if (rank(m.severity) > rank(last.severity)) {
      dedup[dedup.length - 1] = m;
    } else if (rank(m.severity) === rank(last.severity)) {
      const lastLen = last.end - last.start;
      const curLen = m.end - m.start;
      if (curLen > lastLen) dedup[dedup.length - 1] = m;
    }
    // else keep last
  }

  return dedup;
}




