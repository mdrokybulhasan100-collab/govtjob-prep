const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBn(num) {
  return String(num).replace(/[0-9]/g, (d) => BN_DIGITS[d]);
}

export function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ============================================================
// Basic Bangla -> Latin transliteration (best-effort, rule-based).
// Handles the common case well (simple place names, proper nouns
// like "ঢাকা" -> "dhaka"). Bangla's inherent-vowel reduction rules
// mean this WON'T be perfect for every word — it's a helpful
// auto-suggestion, not a guarantee. Admins can always override with
// an explicit comma-separated variant for tricky words.
// ============================================================
const BN_INDEPENDENT_VOWELS = {
  "অ": "a", "আ": "a", "ই": "i", "ঈ": "i", "উ": "u", "ঊ": "u",
  "ঋ": "ri", "এ": "e", "ঐ": "oi", "ও": "o", "ঔ": "ou"
};
const BN_VOWEL_SIGNS = {
  "া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u",
  "ৃ": "ri", "ে": "e", "ৈ": "oi", "ো": "o", "ৌ": "ou"
};
const BN_CONSONANTS = {
  "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "ng",
  "চ": "ch", "ছ": "chh", "জ": "j", "ঝ": "jh", "ঞ": "n",
  "ট": "t", "ঠ": "th", "ড": "d", "ঢ": "dh", "ণ": "n",
  "ত": "t", "থ": "th", "দ": "d", "ধ": "dh", "ন": "n",
  "প": "p", "ফ": "ph", "ব": "b", "ভ": "bh", "ম": "m",
  "য": "y", "র": "r", "ল": "l", "শ": "sh", "ষ": "sh",
  "স": "s", "হ": "h", "ড়": "r", "ঢ়": "rh", "য়": "y", "ৎ": "t"
};
const BN_VIRAMA = "্";

export function banglaToLatin(input) {
  if (!input) return "";
  const chars = Array.from(input);
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (BN_CONSONANTS[ch]) {
      out += BN_CONSONANTS[ch];
      const next = chars[i + 1];
      if (next === BN_VIRAMA) {
        i += 1; // suppress inherent vowel, no extra sound added
      } else if (BN_VOWEL_SIGNS[next]) {
        out += BN_VOWEL_SIGNS[next];
        i += 1;
      } else {
        out += "a"; // inherent vowel
      }
    } else if (BN_INDEPENDENT_VOWELS[ch]) {
      out += BN_INDEPENDENT_VOWELS[ch];
    } else if (ch === " ") {
      out += " ";
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch; // already Latin, pass through
    }
    // punctuation / unrecognized marks are dropped
  }
  return out;
}
