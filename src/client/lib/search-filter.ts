/** Lowercase + strip diacritics: "Finanças" → "financas". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * Deterministic matcher for the command palette (replaces cmdk's fuzzy
 * scoring, which matched scattered letters, e.g. "escuro" → "Configurações").
 *
 * Every query word must appear in the haystack. Score per word:
 *   3 = haystack starts with it, 2 = some word starts with it, 1 = substring.
 * Returns 0 (hidden) .. 1 (best), as cmdk expects.
 */
export function commandFilter(value: string, search: string, keywords: string[] = []): number {
  const query = normalize(search);
  if (!query) return 1;
  const haystack = normalize([value, ...keywords].join(" "));
  const words = haystack.split(/[\s,.;:/()-]+/).filter(Boolean);
  let total = 0;
  const terms = query.split(/\s+/);
  for (const term of terms) {
    if (haystack.startsWith(term)) total += 3;
    else if (words.some((w) => w.startsWith(term))) total += 2;
    else if (haystack.includes(term)) total += 1;
    else return 0;
  }
  return total / (terms.length * 3);
}
