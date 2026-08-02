// Monta um link mantendo os parâmetros atuais e trocando só o que mudou.
// Fica num arquivo próprio (sem JSX) para poder ser usado tanto pelas telas
// do servidor quanto pelos componentes que rodam no navegador.
//
// Qualquer mudança de filtro volta para a página 1 — senão o visitante cai
// numa página que não existe mais no resultado filtrado.
export function buildHref(
  atual: Record<string, string | undefined>,
  mudanca: Record<string, string | null>,
  base = "/search",
) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...atual, ...mudanca })) {
    if (v != null && v !== "") p.set(k, String(v));
  }
  if (!("page" in mudanca)) p.delete("page");
  const s = p.toString();
  return `${base}${s ? `?${s}` : ""}`;
}
