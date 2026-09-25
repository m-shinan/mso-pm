// Display helpers for people. Avatar tints are derived from the user id so a
// person has the same colour everywhere without storing it.

const TINTS = [
  { bg: "#E3E8F7", fg: "#2B4596" },
  { bg: "#F3E6DA", fg: "#8A4A12" },
  { bg: "#DDEFE7", fg: "#1F6B47" },
  { bg: "#EDE4F5", fg: "#5B3C8C" },
  { bg: "#F7F1DA", fg: "#6E5500" },
  { bg: "#DDEDF0", fg: "#1D5F68" },
];

export function tintFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : parts[0][1] ?? "";
  return (first + last).toUpperCase();
}
