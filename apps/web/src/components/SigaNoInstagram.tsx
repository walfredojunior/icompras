import { getTranslations } from "next-intl/server";

// ⚠ O ÍCONE É DESENHADO AQUI, NÃO IMPORTADO. O lucide-react (1.27) **não tem
// mais ícones de marca** — `Instagram` foi removido do pacote e o build quebra
// com "Export Instagram doesn't exist in target module". Desenhar o símbolo em
// SVG resolve de vez: são 3 formas (moldura, lente e ponto), não depende de
// biblioteca nenhuma e não quebra quando o pacote for atualizado.
function IconeInstagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Convite para seguir o iCompras no Instagram.
//
// ⚠ O @ É O MESMO NOS TRÊS IDIOMAS — decisão dele em 14/08/2026. Só a frase
// que acompanha é traduzida; o perfil é um só e não vira chave de tradução,
// senão alguém traduz o nome do perfil por engano e o link quebra.
export const PERFIL = "icompras.py";
const ENDERECO = `https://instagram.com/${PERFIL}`;

/**
 * A versão da HOME: entra logo DEPOIS do bloco "baixaram de preço".
 *
 * 💡 O lugar não foi escolhido por audiência, foi por CONTEXTO. A pessoa
 * acabou de ver produtos que baixaram de preço; o convite continua o que ela
 * está fazendo, em vez de interromper. Convite genérico ("siga a gente") é
 * ignorado; convite que promete mais do que a pessoa já está gostando, não.
 *
 * Ganha peso porque o aviso de queda de preço por notificação **existe mas
 * está desligado** (`price_alert` e `ingest.ts` detectam e não entregam nada).
 * Enquanto isso não entra no ar, o Instagram é o único canal para avisar
 * promoção — e é isso que a frase promete.
 */
export async function SigaNoInstagramHome() {
  const t = await getTranslations("social");

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8">
      <a
        href={ENDERECO}
        target="_blank"
        rel="noopener noreferrer"
        // Coluna no celular, linha no computador: 95% das visitas são de
        // celular (16.774 contra 926 em 7 dias), então o telefone manda no
        // desenho e o resto se adapta.
        className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-center transition hover:border-brand-green hover:shadow-sm sm:flex-row sm:justify-between sm:gap-5 sm:text-left"
      >
        <span className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          {/* O degradê é a identidade visual do Instagram — reconhecido antes
              de a pessoa ler qualquer palavra. */}
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 text-white">
            <IconeInstagram className="h-6 w-6" />
          </span>
          <span>
            <span className="block font-semibold text-slate-900">{t("homeTitle")}</span>
            <span className="block text-sm text-slate-500">@{PERFIL}</span>
          </span>
        </span>
        {/* Botão só de aparência: o cartão inteiro já é o link, e um <a> dentro
            de outro <a> é HTML inválido — quebra em leitor de tela. */}
        <span className="shrink-0 rounded-full bg-brand-navy px-5 py-2 text-sm font-medium text-white">
          {t("follow")}
        </span>
      </a>
    </section>
  );
}

/** A versão do RODAPÉ: discreta, presente em todas as páginas. */
export async function SigaNoInstagramRodape() {
  const t = await getTranslations("social");

  return (
    <a
      href={ENDERECO}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-brand-navy"
      aria-label={`${t("follow")} @${PERFIL}`}
    >
      <IconeInstagram className="h-4 w-4" />
      <span>@{PERFIL}</span>
    </a>
  );
}
