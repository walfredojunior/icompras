import { createHash, randomBytes } from "node:crypto";

/** Hash determinístico (SHA-256) — é o que guardamos no banco, nunca a chave crua. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Gera uma nova chave de API para uma loja. A chave crua só é mostrada uma vez. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString("base64url");
  const key = `ic_${secret}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}
