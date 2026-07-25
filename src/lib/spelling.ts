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
  { from: "kaalej", to: "college" },
  { from: "lerning", to: "learning" },
  { from: "kyapshan", to: "caption" },
  { from: "staart", to: "start" },
  { from: "laast", to: "last" },
  // Soft-launch seed (common Telugu creator / tech code-mix mishears)
  { from: "getup", to: "GitHub" },
  { from: "githab", to: "GitHub" },
  { from: "gitub", to: "GitHub" },
  { from: "phaabul", to: "Fable" },
  { from: "feybul", to: "Fable" },
  { from: "vidiyo", to: "video" },
  { from: "vidiyoo", to: "video" },
  { from: "chollege", to: "college" },
  { from: "yutube", to: "YouTube" },
  { from: "yuutube", to: "YouTube" },
  { from: "instaa", to: "Insta" },
  { from: "reelz", to: "reels" },
  { from: "shaarts", to: "Shorts" },
  { from: "praampts", to: "prompts" },
  { from: "madal", to: "model" },
  { from: "madels", to: "models" },
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

/** Strip leading/trailing punctuation; keep the word core (Latin or Telugu). */
export function wordCore(token: string): string {
  const m = AFFIX.exec(token);
  return m ? m[2] : token;
}

function tokenizeWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map(wordCore)
    .filter((w) => w.length > 0);
}

/**
 * Diff two caption lines and return whole-word corrections the user made
 * (ASR mistake → what they typed). Same word count uses 1:1 pairing; different
 * counts use LCS alignment so inserts/deletes don't invent bad rules.
 *
 * These become the user's "listener" defaults: once learned, the same mistake
 * is auto-corrected on this transcript and on future videos.
 */
export function diffWordCorrections(before: string, after: string): SpellRule[] {
  if (!before?.trim() || !after?.trim() || before === after) return [];
  const a = tokenizeWords(before);
  const b = tokenizeWords(after);
  if (!a.length || !b.length) return [];

  const pairs: Array<[string, string]> = [];
  if (a.length === b.length) {
    for (let i = 0; i < a.length; i++) pairs.push([a[i], b[i]]);
  } else {
    // LCS alignment — only emit rules for substitutions (aligned a≠b).
    const n = a.length;
    const m = b.length;
    // If lengths diverge a lot, treat as rewrite / structural edit — skip learning.
    if (Math.abs(n - m) > Math.max(2, Math.floor(Math.max(n, m) * 0.5))) {
      return [];
    }
    const dp: number[][] = Array.from({ length: n + 1 }, () =>
      Array(m + 1).fill(0),
    );
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        dp[i][j] =
          a[i - 1].toLowerCase() === b[j - 1].toLowerCase()
            ? dp[i - 1][j - 1] + 1
            : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    let i = n;
    let j = m;
    const alignedA: (string | null)[] = [];
    const alignedB: (string | null)[] = [];
    while (i > 0 && j > 0) {
      if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
        alignedA.push(a[i - 1]);
        alignedB.push(b[j - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        alignedA.push(a[i - 1]);
        alignedB.push(null);
        i--;
      } else {
        alignedA.push(null);
        alignedB.push(b[j - 1]);
        j--;
      }
    }
    while (i > 0) {
      alignedA.push(a[i - 1]);
      alignedB.push(null);
      i--;
    }
    while (j > 0) {
      alignedA.push(null);
      alignedB.push(b[j - 1]);
      j--;
    }
    alignedA.reverse();
    alignedB.reverse();
    for (let k = 0; k < alignedA.length; k++) {
      const from = alignedA[k];
      const to = alignedB[k];
      if (from && to) pairs.push([from, to]);
    }
  }

  const out = new Map<string, string>();
  for (const [fromRaw, toRaw] of pairs) {
    const from = fromRaw.trim();
    const to = toRaw.trim();
    if (!from || !to) continue;
    if (from.toLowerCase() === to.toLowerCase()) continue;
    // Skip tiny noise / pure digits (timing typos, not vocabulary).
    if (from.length < 2 || to.length < 2) continue;
    if (/^\d+$/.test(from) && /^\d+$/.test(to)) continue;
    // Skip wild rewrites (insert/delete misalignment or full-line paste).
    const lenRatio = Math.max(from.length, to.length) / Math.min(from.length, to.length);
    if (lenRatio > 2.5) continue;
    out.set(from.toLowerCase(), to);
  }
  // One blur that invents many rules is almost always a rewrite — don't pollute memory.
  const rules = [...out.entries()].map(([from, to]) => ({ from, to }));
  if (rules.length > 5) return [];
  return rules;
}

/** Merge correction lists; later entries win for the same `from` (case-insensitive). */
export function mergeSpellRules(...lists: SpellRule[][]): SpellRule[] {
  const map = new Map<string, string>();
  for (const list of lists) {
    for (const r of list) {
      const from = r.from.trim().toLowerCase();
      const to = r.to.trim();
      if (from && to) map.set(from, to);
    }
  }
  return [...map.entries()].map(([from, to]) => ({ from, to }));
}
