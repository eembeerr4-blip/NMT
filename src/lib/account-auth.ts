import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function normalizeEmail(value: string) {
  return value.trim().normalize("NFKC").toLowerCase();
}

export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function newSecret() {
  return randomBytes(32).toString("base64url");
}

export function secretHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function equalSecret(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
