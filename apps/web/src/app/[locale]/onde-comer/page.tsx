import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { MapPin, Globe, MessageCircle, Star } from "lucide-react";
import { paginaMeta } from "@/lib/seo";
import { registrarVisita } from "@/lib/analytics";
import { getActiveBanners } from "@/lib/banners";
import { EspacoDeBanner } from "@/components/EspacoDeBanner";
import {
  listarRestaurantes,
  cidadesComRestaurante,
  rotuloDoTipo,
  tipoDoLink,
  linkDoWhatsapp,
  TIPOS,
} from "@/lib/restaurantes";

// "ONDE COMER NO PARAGUAI" — a página do guia (22/08/2026).
//
// ⚠ ESTA PÁGINA É A RAZÃO DE O GUIA EXISTIR, e não a faixa na home. A faixa só
// aparece para quem JÁ entrou no site; esta página é indexável e responde a
// "onde comer em Ciudad del Este" — busca que as pessoas fazem ANTES de viajar.
// O Google já rastreia /categorias e /loja, que são páginas de lista iguais a
// esta, então ele está pronto para engoli-la.
//
// 💡 É por isso que os dados são CAMPOS e não estão desenhados dentro da foto:
// o Google não lê texto dentro de imagem.

// ⚠ ÍCONES DE MARCA SÃO DESENHADOS, NÃO IMPORTADOS. O lucide-react (1.27) tirou
// `Instagram` e `Facebook` do pacote, e importar quebra a montagem com
// "Export doesn't exist in target module". O projeto já resolvia assim em
// SigaNoInstagram.tsx — aqui é o mesmo caminho.
function IconeInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconeFacebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z" />
    </svg>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ondeComer" });
  return paginaMeta({
    locale,
    caminho: "/onde-comer",
    titulo: t("seoTitle"),
    descricao: t("seoDesc"),
  });
}

export default async function OndeComerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cidade?: string; tipo?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const t = await getTranslations("ondeComer");
  const ts = await getTranslations("search");

  const [restaurantes, cidades, bannersTopo, bannersMeio, bannersFim] = await Promise.all([
    listarRestaurantes({ cidade: sp.cidade, tipo: sp.tipo }),
    cidadesComRestaurante(),
    getActiveBanners("onde_comer", undefined, "topo"),
    getActiveBanners("onde_comer", undefined, "meio"),
    getActiveBanners("onde_comer", undefined, "fim"),
  ]);

  void registrarVisita("categoria", "onde-comer");

  // Só os tipos que têm restaurante no ar viram filtro: uma caixa com onze
  // opções, das quais nove não devolvem nada, é pior que não ter filtro.
  const tiposComRestaurante = TIPOS.filter((x) => restaurantes.some((r) => r.tipo === x.id));

  const pill = "rounded-full px-3 py-1 text-xs transition";
  const pillOn = "bg-brand-navy font-semibold text-white";
  const pillOff = "border border-slate-200 bg-white text-slate-600 hover:border-brand-green";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <EspacoDeBanner
        banners={bannersTopo}
        slot="topo"
        totalNaPagina={restaurantes.length}
        rotuloPublicidade={ts("ad")}
      />

      <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>

      {/* FILTROS — cidade primeiro, que é o que mais importa: quem vai a Ciudad
          del Este não vai almoçar em Salto del Guairá. */}
      {cidades.length > 1 && (
        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-slate-400">{t("city")}:</span>
          <Link href="/onde-comer" className={`${pill} ${!sp.cidade ? pillOn : pillOff}`}>
            {t("all")}
          </Link>
          {cidades.map((c) => (
            <Link
              key={c.cidade}
              href={`/onde-comer?cidade=${encodeURIComponent(c.cidade)}`}
              className={`${pill} ${sp.cidade === c.cidade ? pillOn : pillOff}`}
            >
              {c.cidade} <span className="opacity-60">{c.n}</span>
            </Link>
          ))}
        </div>
      )}

      {tiposComRestaurante.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-slate-400">{t("kind")}:</span>
          <Link
            href={sp.cidade ? `/onde-comer?cidade=${encodeURIComponent(sp.cidade)}` : "/onde-comer"}
            className={`${pill} ${!sp.tipo ? pillOn : pillOff}`}
          >
            {t("all")}
          </Link>
          {tiposComRestaurante.map((x) => (
            <Link
              key={x.id}
              href={`/onde-comer?${sp.cidade ? `cidade=${encodeURIComponent(sp.cidade)}&` : ""}tipo=${x.id}`}
              className={`${pill} ${sp.tipo === x.id ? pillOn : pillOff}`}
            >
              {rotuloDoTipo(x.id, locale)}
            </Link>
          ))}
        </div>
      )}

      {restaurantes.length === 0 ? (
        <p className="mt-8 text-slate-500">{t("empty")}</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurantes.slice(0, 6).map((r) => (
              <CartaoRestaurante key={r.id} r={r} locale={locale} rotuloDestaque={t("featured")} />
            ))}
          </div>

          <EspacoDeBanner
            banners={bannersMeio}
            slot="meio"
            totalNaPagina={restaurantes.length}
            rotuloPublicidade={ts("ad")}
          />

          {restaurantes.length > 6 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {restaurantes.slice(6).map((r) => (
                <CartaoRestaurante key={r.id} r={r} locale={locale} rotuloDestaque={t("featured")} />
              ))}
            </div>
          )}

          <EspacoDeBanner
            banners={bannersFim}
            slot="fim"
            totalNaPagina={restaurantes.length}
            rotuloPublicidade={ts("ad")}
          />
        </>
      )}

      {/* ⚠ AVISO DE ANÚNCIO, no fim e discreto. O rodapé do site diz que o
          iCompras não tem parceiros; um guia de restaurantes pago precisa dizer
          o que é, senão a lista é lida como recomendação nossa — e um almoço
          ruim vira reclamação contra o site. */}
      <p className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-400">{t("notice")}</p>
    </div>
  );
}

function CartaoRestaurante({
  r,
  locale,
  rotuloDestaque,
}: {
  r: Awaited<ReturnType<typeof listarRestaurantes>>[number];
  locale: string;
  rotuloDestaque: string;
}) {
  const tipoLink = tipoDoLink(r.link);
  const zap = linkDoWhatsapp(r.whatsapp);
  const Icone =
    tipoLink === "instagram"
      ? IconeInstagram
      : tipoLink === "facebook"
        ? IconeFacebook
        : tipoLink === "whatsapp"
          ? MessageCircle
          : Globe;

  const botao =
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition";

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-brand-green">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        {r.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.foto_url}
            alt={r.nome}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl font-bold text-slate-300">
            {r.nome.slice(0, 1).toUpperCase()}
          </div>
        )}
        {r.destaque === 1 && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
            <Star className="h-3 w-3" /> {rotuloDestaque}
          </span>
        )}
      </div>

      <div className="p-3">
        <h2 className="truncate text-sm font-semibold text-slate-900">{r.nome}</h2>
        <p className="text-xs text-slate-500">{rotuloDoTipo(r.tipo, locale)}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{r.endereco ? `${r.endereco} · ${r.cidade}` : r.cidade}</span>
        </p>
        {r.descricao && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{r.descricao}</p>}

        {/* Os dois botões que a pessoa realmente aperta: um para ver as fotos da
            comida, outro para perguntar se tem mesa.
            ⚠ `sponsored` avisa ao Google que é link pago — sem isso ele pode
            entender a lista como recomendação editorial nossa. */}
        <div className="mt-3 flex flex-wrap gap-2">
          {r.link && (
            <a
              href={r.link}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className={`${botao} bg-slate-100 text-slate-700 hover:bg-slate-200`}
            >
              <Icone className="h-3.5 w-3.5" />
              {tipoLink === "instagram"
                ? "Instagram"
                : tipoLink === "facebook"
                  ? "Facebook"
                  : tipoLink === "whatsapp"
                    ? "WhatsApp"
                    : "Site"}
            </a>
          )}
          {zap && (
            <a
              href={zap}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className={`${botao} bg-brand-green-light text-brand-green-dark hover:bg-brand-green hover:text-white`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
