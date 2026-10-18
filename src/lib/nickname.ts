export function normalizeNickname(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function isValidNickname(value: string) {
  return /^[a-z0-9_-]{3,24}$/.test(normalizeNickname(value));
}
