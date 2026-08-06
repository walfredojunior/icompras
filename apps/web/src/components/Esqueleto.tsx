// Esqueletos de carregamento.
//
// Por que blocos cinza no formato do conteúdo, e não uma rodinha girando:
// a rodinha diz "espere" e não diz mais nada; o esqueleto já mostra a FORMA do
// que está vindo, então a pessoa entende a página antes de ela chegar e não
// leva o susto do "pulo" quando o conteúdo aparece. É o que Amazon e YouTube
// fazem, e mede-se que parece mais rápido mesmo demorando o mesmo tempo.
//
// `animate-pulse` é do próprio Tailwind — sem biblioteca nova.

function Bloco({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-slate-200 ${className}`} />;
}

/** Faixa de cartões de produto, no mesmo formato do ProductCard. */
export function EsqueletoCartoes({ n = 12, colunas = "sm:grid-cols-3 lg:grid-cols-6" }: { n?: number; colunas?: string }) {
  return (
    <div className={`grid animate-pulse grid-cols-2 gap-4 ${colunas}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="h-32 bg-slate-100" />
          <div className="flex flex-1 flex-col gap-2 p-3">
            <Bloco className="h-3 w-full" />
            <Bloco className="h-3 w-4/5" />
            <div className="mt-auto pt-2">
              <Bloco className="h-4 w-2/3" />
              {/* O selo de "N lojas" do ProductCard. Sem esta linha o cartão
                  encolhia no instante em que o conteúdo real chegava, e a
                  página dava um pulo — justamente o que o esqueleto existe
                  para evitar. */}
              <Bloco className="mt-2 h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Título de seção + uma linha de apoio. */
export function EsqueletoTitulo({ largura = "w-56" }: { largura?: string }) {
  return (
    <div className="animate-pulse">
      <Bloco className={`h-6 ${largura}`} />
      <Bloco className="mt-2 h-3 w-72 max-w-full" />
    </div>
  );
}

/** Página de produto: foto grande, dados à direita e a tabela de lojas. */
export function EsqueletoProduto() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-8">
      <Bloco className="h-3 w-64 max-w-full" />
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div className="h-72 rounded-2xl bg-slate-100" />
        <div className="flex flex-col gap-3">
          <Bloco className="h-7 w-11/12" />
          <Bloco className="h-7 w-3/5" />
          <Bloco className="mt-4 h-10 w-48" />
          <Bloco className="h-4 w-40" />
          <Bloco className="mt-6 h-11 w-full max-w-xs rounded-lg" />
        </div>
      </div>
      <div className="mt-10 space-y-3">
        <Bloco className="h-5 w-40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-200 p-3">
            <div className="h-10 w-10 rounded-full bg-slate-100" />
            <Bloco className="h-4 flex-1" />
            <Bloco className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Usado enquanto os "produtos relacionados" (cálculo de IA) chegam. */
export function EsqueletoRelacionados({ titulo }: { titulo: string }) {
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
      <div className="mt-4">
        <EsqueletoCartoes n={6} />
      </div>
    </section>
  );
}
