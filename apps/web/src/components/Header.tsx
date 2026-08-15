import { getTranslations, getLocale } from "next-intl/server";
import { TrendingDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { UserMenu } from "./UserMenu";
import { ContadorDaLista } from "./BotaoDaLista";
import { MobileMenu } from "./MobileMenu";
import { SearchOverlay } from "./SearchOverlay";
import { dataComemorativaDeHoje } from "@/lib/datasComemorativas";
import { getCurrentUser } from "@/lib/auth";

export async function Header() {
  const t = await getTranslations("nav");
  const td = await getTranslations("drops");
  const locale = await getLocale();
  const user = await getCurrentUser();

  // O rótulo da lista vem daqui e não do componente: ele roda no navegador e
  // não alcança `getTranslations`, que só existe no servidor.
  const tl = await getTranslations("listas");
  const listaLabel = tl("minhasListas");

  // O tema do dia é calculado NO SERVIDOR e passado pronto: assim o ponto já
  // vem no HTML, sem piscar depois que a página carrega.
  const dataHoje = dataComemorativaDeHoje();
  const tdatas = await getTranslations("datas");
  const temaDoDia = dataHoje ? `${dataHoje.emoji} ${tdatas(dataHoje.chave)}` : null;

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
          <SearchOverlay locale={locale} temaDoDia={temaDoDia} />
        </div>

        {/* A LISTA no cabeçalho — decisão dele em 15/08/2026. Fica visível em
            TODOS os tamanhos de tela (fora do `lg:flex` abaixo) porque 95% das
            visitas são de celular: escondido no menu de três riscos, ninguém
            lembra que tem lista em andamento. */}
        <div className="mr-2 flex items-center lg:mr-0">
          <ContadorDaLista rotulo={listaLabel} />
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
              {/* O link de favoritos saiu daqui em 15/08/2026: o contador com o
                  coração (à esquerda) leva ao mesmo lugar e aparece para TODO
                  visitante, não só para quem tem conta. Dois "Favoritos" no
                  mesmo cabeçalho confundiriam. */}
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
