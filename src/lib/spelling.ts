// Custom spelling dictionary — persistent word corrections a user builds up so recurring
// ASR mistakes (names, places, brand words) come out right without re-editing every video.
// This module is PURE (no DB) so it can run both server-side (processor) and in the browser
// (editor "Apply dictionary"). The server-only loader lives in ./spelling-server.

export interface SpellRule {
  from: string;
  to: string;
}

// Built-in corrections applied to every transcript (before per-user rules), for English
// tech words the ASR reliably mangles into a phonetic spelling that is never a real Telugu
// or English word — so replacing them whole-word is safe. Users' own rules can override or
// extend these via the Dictionary panel. Keep this list high-confidence and unambiguous.
export const BUILTIN_SPELLING: SpellRule[] = [
  { from: "avutput", to: "output" },
  { from: "praampt", to: "prompt" },
  { from: "besik", to: "basic" },
  { from: "staatik", to: "static" },
  { from: "deeteyil", to: "detail" },
  { from: "yaamineshan", to: "animation" },
  { from: "yaamineshans", to: "animations" },
  { from: "prajekt", to: "project" },
  { from: "prajekts", to: "projects" },
  { from: "vebsait", to: "website" },
  { from: "kament", to: "comment" },
  { from: "sekshan", to: "section" },
  { from: "sartiphiket", to: "certificate" },
  { from: "sartiphikets", to: "certificates" },
  { from: "phevaret", to: "favorite" },
  { from: "kriyet", to: "create" },
  { from: "inklud", to: "include" },
  { from: "aplod", to: "upload" },
  { from: "kalej", to: "college" },
  { from: "lerning", to: "learning" },
  { from: "kyapshan", to: "caption" },
];

// Separate a token into leading punctuation / core / trailing punctuation. Uses Unicode
// letter+number classes so it works for Telugu script as well as romanized Latin.
const AFFIX = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u;

/**
 * Apply whole-word corrections to a line of text. Matching is case-insensitive and ignores
 * surrounding punctuation, but only replaces whole words (so "in" never rewrites "india").
 */
export function applySpelling(text: string, rules: SpellRule[]): string {
  if (!text || !rules.length) return text;
  const map = new Map<string, string>();
  for (const r of rules) {
    const from = r.from.trim().toLowerCase();
    if (from) map.set(from, r.to);
  }
  if (!map.size) return text;

  return text
    .split(/(\s+)/) // keep the whitespace runs so spacing is preserved
    .map((tok) => {
      if (!tok.trim()) return tok;
      const m = AFFIX.exec(tok);
      if (!m) return tok;
      const [, lead, core, trail] = m;
      const repl = map.get(core.toLowerCase());
      return repl === undefined ? tok : lead + repl + trail;
    })
    .join("");
}
