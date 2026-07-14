import Sanscript from "@indic-transliteration/sanscript";

const TELUGU = /[ఀ-౿]/;
const TELUGU_RUN = /[ఀ-౿]+/g;

/**
 * Romanize Telugu text (Telugu script → Latin letters), e.g. "నమస్కారం" → "Namaskaram".
 *
 * Only the Telugu-script runs are transliterated; already-Latin content (English words,
 * numbers, punctuation) passes through untouched. This is essential for code-mixed captions
 * (e.g. Sarvam "codemix" mode), where a line like "So ఈ video website అయితే" must keep
 * "video"/"website" as real English — otherwise the naturalization rules below (notably the
 * IAST c→ch step) would mangle English words into "chollege", "chreate", "sechtion", etc.
 *
 * Text with no Telugu characters is returned unchanged, so output that is already romanized
 * (Sarvam translit/codemix passthrough) is a no-op.
 */
export function romanizeTelugu(input: string): string {
  if (!input || !TELUGU.test(input)) return input;

  // Drop zero-width joiners/non-joiners used inside Telugu consonant clusters.
  const cleaned = input.replace(/[‌‍]/g, "");

  // Transliterate each contiguous Telugu run; leave everything else as-is.
  const out = cleaned.replace(TELUGU_RUN, romanizeRun);

  // Capitalize the first letter for readability.
  return out.replace(
    /^(\s*)([a-z])/,
    (_m, sp: string, ch: string) => sp + ch.toUpperCase(),
  );
}

/** Transliterate one contiguous run of Telugu script into naturalized Latin letters. */
function romanizeRun(run: string): string {
  let s = Sanscript.t(run, "telugu", "iast").normalize("NFC");

  // Naturalize common IAST forms toward how Telugu is usually written in Latin script.
  s = s.replace(/[ṣś]/g, "sh"); // ṣ, ś → sh
  s = s.replace(/ṃ(?=[\s.,!?;:'"\-]|$)/g, "m"); // anusvara at run/word end → m
  s = s.replace(/ṃ(?=[pbm])/g, "m"); // anusvara before labials → m
  s = s.replace(/ṃ/g, "n"); // anusvara otherwise → n
  s = s.replace(/[ṅñ]/g, "n"); // ṅ, ñ → n
  s = s.replace(/ch/g, "chh").replace(/c/g, "ch"); // IAST "c" is the "ch" sound

  // Preserve long vowels the way Telugu is written in Latin: ā→aa, ī→ee, ū→oo. Without this
  // the NFKD strip below would flatten every long vowel to a short one (mīru→miru instead of
  // meeru, chūsē→chuse instead of choose). ē/ō intentionally stay single via the strip.
  s = s.replace(/ā/g, "aa").replace(/ī/g, "ee").replace(/ū/g, "oo");

  // Decompose and strip remaining combining diacritics → clean ASCII.
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}
