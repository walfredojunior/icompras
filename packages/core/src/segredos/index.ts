import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// GUARDAR SEGREDO NO BANCO SEM DEIXÁ-LO LEGÍVEL A OLHO NU.
//
// Serve para as chaves dos serviços de IA (migração 053). O banco tem backup
// diário e cópia em disco; chave de serviço pago em texto puro ali é a mesma
// classe de erro que a senha escrita no código, que a trava do "salve tudo"
// recusou publicar em 10/08/2026 — só um passo adiante.
//
// ⚠ ISTO NÃO É COFRE. Quem tem o `AUTH_SECRET` e o banco lê tudo — e quem tem
// o servidor tem os dois. O que isto resolve é o caso realista: um dump do
// banco, uma cópia de backup, uma consulta feita por engano numa tela, o valor
// aparecendo num registro. Proteção contra vazamento acidental, não contra
// invasor com o servidor na mão. Chamar de cofre seria mentira.
//
// ====================================================================
// ⚠ POR QUE ISTO ESTÁ AQUI, E NÃO SÓ NO SITE (17/08/2026)
// ====================================================================
// A lógica nasceu em `apps/web/src/lib/segredos.ts`. Quando o ROBÔ passou a
// precisar da chave do DeepSeek (para classificar produtos em massa), ele
// precisou decifrar também — e robô não pode importar de dentro do site.
//
// A cópia do site continua lá, intacta, de propósito: mudá-la obrigaria a
// recompilar e reiniciar o site, e não se derruba o site com gente usando por
// causa de uma refatoração. **Na próxima publicação do site, aquele arquivo
// deve virar um repasse deste** (`export * from "@icompras/core"`), e aí passa
// a existir um lugar só.
//
// Enquanto houver duas cópias: se a cifra mudar num lado, o outro para de
// decifrar e **avisa** (`decifrar` devolve null → "sem chave do DeepSeek"), em
// vez de gravar coisa errada em silêncio. Falha barulhenta é aceitável;
// divergência silenciosa não seria.

const ALGORITMO = "aes-256-gcm";

/**
 * A chave de cifra sai do `AUTH_SECRET`, obrigatório em produção desde
 * 10/08/2026 — assim não há um segredo novo para guardar em algum lugar (o que
 * seria só empurrar o problema).
 *
 * ⚠ TROCAR O `AUTH_SECRET` TORNA TODAS AS CHAVES ILEGÍVEIS. Não se perde nada
 * de verdade — basta cadastrar as chaves de novo na tela —, mas é preciso saber
 * disso antes, e não descobrir quando a IA parar de funcionar.
 */
function chaveDeCifra(): Buffer | null {
  const s = process.env.AUTH_SECRET;
  if (!s || s.trim().length < 16) return null;
  // `scrypt` com sal fixo: o sal aqui não protege contra dicionário (o segredo
  // já é longo e aleatório), só deriva 32 bytes estáveis a partir dele.
  return scryptSync(s, "icompras:segredos:v1", 32);
}

/** Cifra para guardar. Devolve null se não houver como cifrar. */
export function cifrarSegredo(texto: string): string | null {
  const chave = chaveDeCifra();
  if (!chave || !texto) return null;
  const iv = randomBytes(12);
  const c = createCipheriv(ALGORITMO, chave, iv);
  const dado = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  // iv.marca.dado — a marca (auth tag) é o que denuncia adulteração.
  return `${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${dado.toString("base64")}`;
}

/**
 * Decifra. Devolve null se a chave mudou, o valor foi adulterado ou o formato
 * não é o nosso.
 *
 * ⚠ NUNCA joga exceção. Um segredo ilegível tem de virar "serviço desligado",
 * não processo quebrado no meio de um lote.
 */
export function decifrarSegredo(guardado: string | null | undefined): string | null {
  const chave = chaveDeCifra();
  if (!chave || !guardado) return null;
  try {
    const [iv, marca, dado] = guardado.split(".");
    if (!iv || !marca || !dado) return null;
    const d = createDecipheriv(ALGORITMO, chave, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(marca, "base64"));
    return Buffer.concat([d.update(Buffer.from(dado, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
