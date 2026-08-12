// Resposta imediata ao clique no menu.
//
// O Suspense de dentro da página já evita que o bloco pesado segure o resto —
// isto aqui cobre o instante ANTES disso: entre o clique e o servidor começar
// a responder. Sem nada, o menu fica parado e a pessoa clica de novo.
export default function CarregandoLeads() {
  return (
    <div aria-hidden="true">
      <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-slate-100" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
