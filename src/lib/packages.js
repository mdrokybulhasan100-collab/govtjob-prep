export const PACKAGES = [
  { key: "1m", label: "১ মাস", days: 30, price: 20 },
  { key: "3m", label: "৩ মাস", days: 90, price: 50 },
  { key: "6m", label: "৬ মাস", days: 180, price: 100 },
  { key: "12m", label: "১২ মাস", days: 360, price: 150 }
];

export function packageByKey(key) {
  return PACKAGES.find((p) => p.key === key);
}
