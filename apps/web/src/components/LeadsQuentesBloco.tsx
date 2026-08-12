import { lojasQueSairam, lojasQueEncolheram, lojasEmObservacao, leituraConfiavel } from "@/lib/leadsQuentes";
import { LeadsQuentes } from "./LeadsQuentes";

// O bloco pesado da tela de leads, isolado de propósito.
//
// ⚠ POR QUE ESTE ARQUIVO EXISTE (11/08/2026). Ele disse: "quando clico em
// lojas (leads) ele demora a aparecer". A varredura já tinha caído de 10 s
// para 1,3 s, mas 1,3 s de tela em branco ainda parece travamento — e "não
// acontece nada" foi exatamente como ele descreveu o problema anterior.
//
// A resposta melhor que uma tela de "carregando" é não fazer ninguém esperar
// pelo que já está pronto: a lista completa de lojas é rápida e aparece na
// hora; só ESTE bloco fica pendurado, com um esqueleto no lugar, e se encaixa
// sozinho quando termina. Quem abriu a tela já pode trabalhar enquanto isso.
export async function LeadsQuentesBloco() {
  const [sairam, encolheram, observacao] = await Promise.all([
    lojasQueSairam(),
    lojasQueEncolheram(),
    lojasEmObservacao(),
  ]);
  const confianca = await leituraConfiavel(sairam.length + observacao.length);

  return (
    <LeadsQuentes
      sairam={confianca.ok ? sairam : []}
      encolheram={confianca.ok ? encolheram : []}
      observacao={confianca.ok ? observacao : []}
      aviso={confianca.motivo}
    />
  );
}

/** O que ocupa o lugar enquanto a varredura roda. */
export function EsqueletoLeads() {
  return (
    <div className="mb-8 space-y-6" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="h-4 w-56 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-80 max-w-full animate-pulse rounded bg-slate-100" />
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((l) => (
              <div key={l} className="h-8 w-full animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-400">Procurando lojas que saíram do concorrente…</p>
    </div>
  );
}
