import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { MinhasListas } from "@/components/MinhasListas";
import { paginaMeta } from "@/lib/seo";

// MINHAS LISTAS — a página onde a lista de desejos vive.
//
// ⚠ A LISTA ESTÁ NO NAVEGADOR, não no servidor. Esta página é só a moldura: o
// conteúdo é montado no aparelho da pessoa por `MinhasListas`, que lê o
// armazenamento local e busca os preços de agora.
//
// Por isso a página é **fora do índice do Google** (`noindex`): para o robô ela
// é sempre uma casca vazia, e indexar isso só geraria resultado inútil na busca.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "listas" });
  return {
    ...paginaMeta({
      locale,
      caminho: "/favoritos",
      titulo: t("titulo"),
      descricao: t("subtitulo"),
    }),
    robots: { index: false, follow: true },
  };
}

export default async function ListasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "listas" });

  // Os textos vão prontos para o componente do navegador: ele não consegue
  // usar `getTranslations`, que só existe no servidor.
  const textos: Record<string, string> = {
    criar: t("criar"),
    novaPadrao: t("novaPadrao"),
    nomeDaLista: t("nomeDaLista"),
    compartilhar: t("compartilhar"),
    apagarLista: t("apagarLista"),
    confirmaApagar: t("confirmaApagar"),
    listaVazia: t("listaVazia"),
    vazioTitulo: t("vazioTitulo"),
    vazioTexto: t("vazioTexto"),
    total: t("total"),
    cota: t("cota"),
    cotaNota: t("cotaNota"),
    aindaCabe: t("aindaCabe"),
    passou: t("passou"),
    semOferta: t("semOferta"),
    foraDoAr: t("foraDoAr"),
    eraPor: t("eraPor"),
    foraDoArUm: t("foraDoArUm"),
    foraDoArVarios: t("foraDoArVarios"),
    semPrecoUm: t("semPrecoUm"),
    semPrecoVarios: t("semPrecoVarios"),
    buscandoPreco: t("buscandoPreco"),
    lojas: t("lojas"),
    mais: t("mais"),
    menos: t("menos"),
    remover: t("remover"),
    zapPrefixo: t("zapPrefixo"),
    erroCompartilhar: t("erroCompartilhar"),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Heart className="h-6 w-6 text-brand-green-dark" />
          {t("titulo")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitulo")}</p>
      </header>
      <MinhasListas textos={textos} />
    </div>
  );
}
