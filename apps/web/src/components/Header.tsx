import { getTranslations, getLocale } from "next-intl/server";
import { TrendingDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { UserMenu } from "./UserMenu";
import { MobileMenu } from "./MobileMenu";
import { SearchOverlay } from "./SearchOverlay";
import { getCurrentUser } from "@/lib/auth";

export async function Header() {
  const t = await getTranslations("nav");
  const td = await getTranslations("drops");
  const locale = await getLocale();
  const user = await getCurrentUser();

  const mobileLabels = {
    home: locale === "es" ? "Inicio" : locale === "en" ? "Home" : "Início",
    stores: locale === "es" ? "Tiendas" : locale === "en" ? "Stores" : "Lojas",
    favorites: locale === "es" ? "Favoritos" : locale === "en" ? "Saved" : "Favoritos",
    alerts: t("alerts"),
    drops: td("homeTitle"),
    login: t("login"),
    register: t("register"),
    logout: t("logout"),
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-1">
          <MobileMenu user={user ? user.email : null} labels={mobileLabels} />
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="h-8 w-auto sm:h-9" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-wordmark.png" alt="iCompras" className="h-6 w-auto" />
          </Link>
        </div>
        {/* Busca em todas as páginas: antes só existia na home e na tela de
            resultados, então de dentro de um produto não havia como procurar
            outra coisa. */}
        <div className="ml-auto mr-3 lg:mr-4">
          <SearchOverlay locale={locale} />
        </div>

        <nav className="hidden items-center gap-4 text-sm lg:flex">
          {/* Único item fixo do menu: é a página que muda todo dia e o motivo
              para a pessoa voltar. A setinha para baixo diz "preço caindo"
              antes mesmo de a pessoa ler. */}
          <Link
            href="/quedas"
            className="flex items-center gap-1.5 font-medium text-brand-green-dark hover:underline"
          >
            <TrendingDown className="h-4 w-4" />
            {td("homeTitle")}
          </Link>
          {user ? (
            <>
              <Link href="/favoritos" className="text-slate-600 hover:text-brand-navy">
                {mobileLabels.favorites}
              </Link>
              <Link href="/alertas" className="text-slate-600 hover:text-brand-navy">
                {t("alerts")}
              </Link>
              <UserMenu email={user.email} logoutLabel={t("logout")} />
            </>
          ) : null}
          {/* CONTA DESLIGADA (2026-07-31) — decisão do dono do site.
              O alerta de preço, que é a razão de alguém criar conta aqui,
              nunca chegou a funcionar: quem sabe avisar sobre queda de preço
              só roda quando uma LOJA envia lista de preços pela API, e quem
              atualiza os 76 mil preços por dia é o coletor, que não conversa
              com essa parte. Convidar para cadastro seria prometer um aviso
              que não chega.

              As páginas /entrar e /cadastro continuam existindo e
              funcionando — só não são mais anunciadas. Para religar, é só
              descomentar aqui, no MobileMenu e no Footer.

          <>
            <Link href="/entrar" className="text-slate-600 hover:text-brand-navy">
              {t("login")}
            </Link>
            <Link
              href="/cadastro"
              className="rounded-full bg-brand-navy px-4 py-2 font-medium text-white hover:bg-brand-navy-dark"
            >
              {t("register")}
            </Link>
          </>
          */}
        </nav>
      </div>
    </header>
  );
}
