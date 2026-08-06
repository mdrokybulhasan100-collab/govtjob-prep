const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBn(num) {
  return String(num).replace(/[0-9]/g, (d) => BN_DIGITS[d]);
}

export function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
