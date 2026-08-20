import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { SigaNoInstagramRodape } from "./SigaNoInstagram";

export async function Footer() {
  // const t = await getTranslations("nav");  // volta junto com os links de conta abaixo
  const f = await getTranslations("footer");

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-start gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-full.png" alt="iCompras" className="h-20 w-auto" />
            <p className="mt-3 text-sm text-slate-500">{f("tagline")}</p>
            {/* Rede social junto da logo, e não na coluna de links: aqui é o
                bloco de identidade do site (marca + o que ele é), e o perfil
                pertence a essa ideia. Na coluna ao lado ficaria parecendo mais
                um item de navegação. */}
            <SigaNoInstagramRodape />
          </div>
          <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
            <Link href="/" className="text-slate-600 hover:text-brand-navy">{f("home")}</Link>
            {/* LISTA DE LOJAS TIRADA DO RODAPÉ (08/08/2026, decisão do dono).
                Aquela página mostra TODAS as lojas com logo, cidade e quantos
                produtos cada uma tem, ordenadas da maior para a menor — ou seja,
                o raio-x da cobertura do iCompras. Um concorrente montaria a lista
                de alvos dele em dois minutos.

                ⚠ Só o LINK saiu. A página continua no ar e no mapa do site, e as
                páginas de cada loja (/loja/slug) seguem intactas — são elas que
                trazem visitante do Google e o destino do "Ver loja" das ofertas.
                Ele pediu explicitamente só isto: "só esconda a opção de ver lojas
                no rodapé do site, isso pra mim já basta".
            <Link href="/lojas" className="text-slate-600 hover:text-brand-navy">{f("stores")}</Link>
            */}
            {/* CONTA DESLIGADA (2026-07-31) — ver o porquê no Header.tsx.
            <Link href="/entrar" className="text-slate-600 hover:text-brand-navy">{t("login")}</Link>
            <Link href="/cadastro" className="text-slate-600 hover:text-brand-navy">{t("register")}</Link>
            */}
          </nav>
        </div>

        {/* Aviso contra uso indevido da marca. Fica no rodapé para aparecer em
            TODAS as páginas — inclusive nas de produto e de loja, que é onde
            alguém teria mais interesse em se passar pelo iCompras.
            Ícone de escudo (e não megafone): a mensagem protege o visitante,
            não anuncia nada. */}
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-amber-900">{f("noticeTitle")}</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">{f("noticeText")}</p>
          </div>
        </div>

        {/* Idioma no rodapé, em todas as páginas: o site abre em português e
            quem fala espanhol precisa poder trocar de onde estiver — a maior
            parte das visitas entra pelo Google direto num produto. */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
          {/* TRÊS ITENS NUMA LINHA SÓ: copyright · idioma · quem fez.
              O `justify-between` distribui os três — copyright na esquerda,
              idioma no meio, crédito na direita. Escolha dele em 20/08/2026,
              depois de ver as opções lado a lado.
              💡 Foi um ACIDENTE que virou decisão: o demo que montei fechava
              uma marcação no lugar errado e jogou o crédito para a direita em
              vez do centro. Ele viu e preferiu assim.
              ⚠ Link externo leva `rel="noopener noreferrer"` como o resto do
              projeto: sem isso a página de destino recebe uma referência à aba
              de origem e pode redirecioná-la. */}
          <span className="text-xs text-slate-400">© 2026 iCompras · Paraguay</span>
          <LocaleSwitcher />
          <span className="text-xs text-slate-400">
            {f("developedBy")}{" "}
            <a
              href="https://infoserve.com.py"
              target="_blank"
              rel="noopener noreferrer"
              className="isv font-semibold text-slate-500 transition hover:text-brand-navy hover:underline"
            >
              INFOSERVE
              {/* Os três pontinhos que cintilam. Ficam DENTRO do link para
                  acompanharem o nome quando a linha quebra no celular.
                  `aria-hidden`: são enfeite, e um leitor de tela anunciando
                  três pontos vazios só atrapalharia quem usa. */}
              <i className="isv-ponto" aria-hidden="true" />
              <i className="isv-ponto" aria-hidden="true" />
              <i className="isv-ponto" aria-hidden="true" />
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
