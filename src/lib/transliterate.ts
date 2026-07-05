import Sanscript from "@indic-transliteration/sanscript";

const TELUGU = /[ఀ-౿]/;

/**
 * Romanize Telugu text (Telugu script → Latin letters), e.g.
 * "నమస్కారం" → "Namaskaram". Rule-based: Sanscript IAST + naturalization tweaks so the
 * output reads the way Telugu is usually written in English letters.
 *
 * Text with no Telugu characters is returned unchanged, so output from a provider that
 * already romanized (e.g. Sarvam translit mode) passes straight through.
 */
export function romanizeTelugu(input: string): string {
  if (!input || !TELUGU.test(input)) return input;

  // Drop zero-width joiners/non-joiners used inside Telugu consonant clusters.
  const cleaned = input.replace(/[‌‍]/g, "");

  let s = Sanscript.t(cleaned, "telugu", "iast").normalize("NFC");

  // Naturalize common IAST forms toward how Telugu is usually written in Latin script.
  s = s.replace(/[ṣś]/g, "sh"); // ṣ, ś → sh
  s = s.replace(/ṃ(?=[\s.,!?;:'"\-]|$)/g, "m"); // anusvara at word end → m
  s = s.replace(/ṃ(?=[pbm])/g, "m"); // anusvara before labials → m
  s = s.replace(/ṃ/g, "n"); // anusvara otherwise → n
  s = s.replace(/[ṅñ]/g, "n"); // ṅ, ñ → n
  s = s.replace(/ch/g, "chh").replace(/c/g, "ch"); // IAST "c" is the "ch" sound

  // Decompose and strip all combining diacritics → clean ASCII.
  s = s.normalize("NFKD").replace(/[̀-ͯ]/g, "");

  // Capitalize the first letter for readability.
  return s.replace(
    /^(\s*)([a-z])/,
    (_m, sp: string, ch: string) => sp + ch.toUpperCase(),
  );
}
