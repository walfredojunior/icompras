"use client";

import { useEffect, useState } from "react";

// "● 7 agora" — quantas pessoas estão no site neste momento.
//
// Pedido dele em 17/08/2026: *"de forma discreta"*. Por isso é uma linha
// pequena dentro do cartão que já existe, e não mais um cartão: o painel já
// tem cinco, e um sexto competindo por atenção não é discreto.
//
// O ponto pisca devagar só quando há alguém. Com zero, ele fica parado e
// cinza — animação sem informação é enfeite, e enfeite em painel cansa.
export default function AgoraNoSite() {
  const [agora, setAgora] = useState<number | null>(null);
  const [janela, setJanela] = useState(5);

  useEffect(() => {
    let vivo = true;

    async function ler() {
      // Só pergunta com a aba à vista. Painel esquecido aberto a tarde inteira
      // não deve ficar batendo no servidor — é a mesma disciplina que se cobra
      // dos robôs.
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/admin/online", { cache: "no-store" });
        if (!r.ok || !vivo) return;
        const d = await r.json();
        setAgora(Number(d.agora ?? 0));
        if (d.janelaMinutos) setJanela(Number(d.janelaMinutos));
      } catch {
        /* número de enfeite: se falhar, some em silêncio em vez de dar erro */
      }
    }

    ler();
    const t = setInterval(ler, 30_000);
    document.addEventListener("visibilitychange", ler);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", ler);
    };
  }, []);

  // Enquanto não chegou a primeira resposta, não mostra nada: um "0" que depois
  // vira "7" faz o painel parecer errado nos primeiros instantes.
  if (agora === null) return null;

  const alguem = agora > 0;
  return (
    <div
      className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"
      title={`Pessoas que abriram alguma página nos últimos ${janela} minutos`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          alguem ? "animate-pulse bg-emerald-500" : "bg-slate-300"
        }`}
      />
      <span>
        <span className={alguem ? "font-semibold text-slate-700" : ""}>{agora}</span>{" "}
        {agora === 1 ? "pessoa agora" : "pessoas agora"}
      </span>
    </div>
  );
}
