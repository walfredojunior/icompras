import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Guarda segredo no banco sem deixá-lo legível a olho nu.
//
// Serve para as chaves dos serviços de IA (ver migração 053). O banco tem
// backup diário e cópia em disco; chave de serviço pago em texto puro ali é a
// mesma classe de erro que a senha que estava escrita no código e que a trava
// do "salve tudo" recusou publicar em 10/08/2026 — só que um passo adiante.
//
// ⚠ ISTO NÃO É COFRE. Quem tem o `AUTH_SECRET` e o banco lê tudo — e quem tem
// o servidor tem os dois. O que isto resolve é o caso realista: um dump do
// banco, uma cópia de backup, uma consulta feita por engano numa tela, o valor
// aparecendo num registro. Proteção contra vazamento acidental, não contra
// invasor com o servidor na mão. Chamar de cofre seria mentira.
//
// ====================================================================
// ⚠⚠ EXISTE UMA SEGUNDA CÓPIA DISTO: `packages/core/src/segredos/index.ts`
// ====================================================================
// O robô passou a precisar decifrar a chave do DeepSeek (17/08/2026) para
// classificar produtos em massa, e robô não importa de dentro do site.
//
// **Duas cópias é decisão consciente, não descuido.** Unificar exigiria fazer
// o site depender de um pacote interno — e o site é propositalmente
// independente: hoje ele não importa NENHUM `@icompras/*`. Criar essa
// dependência mexeria na montagem do site inteiro, o que é muito risco por 40
// linhas de cifra que não mudam nunca.
//
// **O QUE MANTÉM ISTO SEGURO:** se um lado mudar (algoritmo, sal, formato), o
// outro simplesmente **para de decifrar e avisa** — `decifrar` devolve null e
// vira "sem chave do DeepSeek" no relatório. Falha barulhenta e inofensiva,
// nunca dado gravado errado em silêncio.
//
// ⚠ Ao mexer aqui, mexer LÁ no mesmo dia. As duas precisam continuar iguais:
// mesmo algoritmo (aes-256-gcm), mesmo sal ("icompras:segredos:v1"), mesmo
// formato (iv.marca.dado em base64).

const ALGORITMO = "aes-256-gcm";

/**
 * A chave de cifra sai do `AUTH_SECRET`, que desde 10/08/2026 é obrigatório em
 * produção — o site recusa autenticar sem ele. Assim não há um segredo novo
 * para guardar em algum lugar (que seria só empurrar o problema).
 *
 * ⚠ TROCAR O `AUTH_SECRET` TORNA TODAS AS CHAVES ILEGÍVEIS. Não se perde nada
 * de verdade — é só cadastrar as chaves de novo na tela —, mas é preciso saber
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
export function cifrar(texto: string): string | null {
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
 * ⚠ NUNCA joga exceção. Isto é chamado ao montar telas e ao acionar serviços;
 * um segredo ilegível tem de virar "serviço desligado", não página quebrada.
 */
export function decifrar(guardado: string | null | undefined): string | null {
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

/**
 * Como a chave aparece na tela: só os últimos caracteres.
 *
 * A tela de Anotações mostra as senhas dos servidores inteiras porque ele
 * pediu assim, e ali faz sentido — é o caderno dele. Chave de API é outra
 * coisa: ele nunca precisa LER de volta (se precisar, está no site do
 * provedor), então mostrar só confirma qual está lá e evita que o valor
 * trafegue à toa até o navegador.
 */
export function mascarar(segredo: string | null): string | null {
  if (!segredo) return null;
  return segredo.length <= 4 ? "••••" : `••••${segredo.slice(-4)}`;
}
