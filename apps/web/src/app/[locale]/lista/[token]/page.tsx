import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Heart } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { pool } from "@/lib/db";
import { paginaMeta } from "@/lib/seo";

// A LISTA COMPARTILHADA — o que a pessoa vê ao abrir o link do WhatsApp.
//
// 💡 Os PREÇOS são buscados agora, não os do dia em que a lista foi montada.
// É o que dá sentido a compartilhar a lista de um comparador: quem recebe vê
// quanto custa hoje. Guardar o preço junto com a lista faria dela um papel.
//
// Não exige conta nem login: quem tem o link, vê. O código de 8 caracteres é
// o que protege — 2,8 trilhões de combinações, não se adivinha por tentativa.
//
// `noindex` de propósito: são listas particulares de pessoas. Não devem
// aparecer na busca do Google mesmo sendo abertas por link.

const COTA_USD = 500;

interface Item { p: number; q: number; o?: string }

async function carregar(token: string) {
  if (!/^[a-z0-9]{4,16}$/.test(token)) return null;
  const linhas = await pool.query(
    "SELECT token, nome, itens FROM lista_compartilhada WHERE token = ? LIMIT 1",
    [token],
  );
  if (!linhas.length) return null;

  let itens: Item[] = [];
  try {
    const dados = typeof linhas[0].itens === "string" ? JSON.parse(linhas[0].itens) : linhas[0].itens;
    itens = Array.isArray(dados?.itens) ? dados.itens : [];
  } catch {
    return null;
  }
  if (!itens.length) return null;

  const ids = [...new Set(itens.map((i) => Number(i.p)).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return null;

  const vagas = ids.map(() => "?").join(",");
  const produtos = await pool.query(
    `SELECT p.id, p.slug, p.canonical_name AS nome, p.primary_image_url AS imagem,
            -- ⚠ SEM COALESCE com min_price_usd: ver o comentário em
            -- /api/listas/precos. Preço só existe se houver oferta ATIVA;
            -- senão a lista compartilhada mostraria preço de produto que
            -- ninguém vende mais, e ainda somaria no total.
            (SELECT MIN(o.price_usd) FROM offer o JOIN product_variant v ON v.id = o.variant_id
              WHERE v.product_id = p.id AND o.in_stock = 1) AS preco,
            (SELECT COUNT(DISTINCT o.store_id) FROM offer o JOIN product_variant v ON v.id = o.variant_id
              WHERE v.product_id = p.id AND o.in_stock = 1) AS lojas
       FROM product p WHERE p.id IN (${vagas})`,
    ids,
  );

  const porId = new Map(produtos.map((r: any) => [Number(r.id), r]));
  const linha = itens
    .map((i) => {
      const p = porId.get(Number(i.p));
      if (!p) return null;
      const preco = p.preco == null ? null : Number(p.preco);
      return {
        id: Number(p.id), slug: p.slug, nome: p.nome, imagem: p.imagem ?? null,
        lojas: Number(p.lojas ?? 0), quantidade: Math.max(1, Number(i.q) || 1), preco,
      };
    })
    .filter(Boolean) as Array<{ id: number; slug: string; nome: string; imagem: string | null; lojas: number; quantidade: number; preco: number | null }>;

  if (!linha.length) return null;

  // Conta de visualização — é o que decide quais listas a limpeza pode apagar.
  // Falha aqui não pode derrubar a página: é estatística, não conteúdo.
  pool
    .query("UPDATE lista_compartilhada SET vista_em = NOW(), vezes_vista = vezes_vista + 1 WHERE token = ?", [token])
    .catch(() => {});

  return { nome: String(linhas[0].nome), itens: linha };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}): Promise<Metadata> {
  const { locale, token } = await params;
  const t = await getTranslations({ locale, namespace: "listas" });
  const lista = await carregar(token);
  return {
    ...paginaMeta({
      locale,
      caminho: `/lista/${token}`,
      titulo: lista ? `${lista.nome} — ${t("compartilhadaTitulo")}` : t("naoEncontrada"),
      descricao: t("compartilhadaDescricao"),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function ListaCompartilhadaPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "listas" });

  const lista = await carregar(token);
  if (!lista) notFound();

  const comPreco = lista.itens.filter((i) => i.preco != null);
  const total = comPreco.reduce((s, i) => s + (i.preco ?? 0) * i.quantidade, 0);
  const semPreco = lista.itens.length - comPreco.length;
  const passou = total > COTA_USD;
  const pct = Math.min(100, Math.round((total / COTA_USD) * 100));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-green-dark">
          {t("compartilhadaTitulo")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Heart className="h-6 w-6 text-brand-green-dark" />
          {lista.nome}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t("precosDeAgora")}</p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {lista.itens.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/produto/${i.slug}`} className="flex h-14 w-14 shrink-0 items-center justify-center">
                {i.imagem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imagem} alt="" className="max-h-14 object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/logo-icon.png" alt="" className="h-8 w-auto opacity-30" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/produto/${i.slug}`} className="line-clamp-2 text-sm font-medium text-slate-800 hover:text-brand-navy">
                  {i.nome}
                </Link>
                {i.preco != null ? (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {i.quantidade > 1 && `${i.quantidade} × `}
                    {`US$ ${i.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${i.lojas ? ` · ${i.lojas} ${t("lojas")}` : ""}`}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs font-medium text-amber-600">{t("foraDoAr")}</p>
                )}
              </div>
              <span className="w-24 shrink-0 text-right text-sm font-semibold text-slate-900">
                {i.preco != null ? `US$ ${(i.preco * i.quantidade).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
              </span>
            </li>
          ))}
        </ul>

        <footer className="border-t border-slate-100 bg-slate-50 px-4 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-600">{t("total")}</span>
            <span className="text-2xl font-bold text-slate-900">
              US$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          {semPreco > 0 && (
            <p className="mt-1 text-right text-xs text-amber-600">
              {semPreco} {semPreco === 1 ? t("foraDoArUm") : t("foraDoArVarios")}
            </p>
          )}
          <div className="mt-3 border-t border-slate-200 pt-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-600">{t("cota")}</span>
              <span className={passou ? "font-semibold text-rose-600" : "font-medium text-slate-700"}>
                {passou
                  ? `${t("passou")} US$ ${(total - COTA_USD).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  : `${t("aindaCabe")} US$ ${(COTA_USD - total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full ${passou ? "bg-rose-500" : pct > 80 ? "bg-amber-400" : "bg-brand-green"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">{t("cotaNota")}</p>
          </div>
        </footer>
      </div>

      {/* Quem recebeu a lista de um amigo é visitante novo: o convite para
          montar a própria é o que transforma o compartilhamento em audiência. */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-center">
        <p className="text-sm text-slate-600">{t("facaSua")}</p>
        <Link href="/favoritos" className="mt-3 inline-block rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-medium text-white">
          {t("criarMinha")}
        </Link>
      </div>
    </div>
  );
}
