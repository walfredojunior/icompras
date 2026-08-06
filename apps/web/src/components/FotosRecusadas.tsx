import { ImageOff } from "lucide-react";
import type { FotoRecusada } from "@/lib/clients";

// AS FOTOS QUE A PORTARIA RECUSOU, em português de gente.
//
// A portaria (packages/core/src/media/seguranca.ts) aceita o produto e joga
// fora só a foto — decisão do dono em 06/08/2026, para não castigar o lojista
// por um erro pequeno. O efeito colateral é o silêncio: a loja manda o
// catálogo, recebe "sucesso" e as fotos não aparecem.
//
// Esta tela existe para o dono poder ligar para a loja e dizer O QUE corrigir.
// Por isso cada motivo vem com a frase que ele repetiria ao telefone — e não
// com o código interno.

const EXPLICACAO: Record<string, { titulo: string; comoResolver: string }> = {
  "endereco-invalido": {
    titulo: "O endereço da foto não é um endereço válido",
    comoResolver: "Conferir se o link foi copiado inteiro, sem espaços nem quebras de linha.",
  },
  "protocolo-proibido": {
    titulo: "O endereço não começa com http:// ou https://",
    comoResolver: "Enviar o endereço completo da imagem, como aparece na barra do navegador.",
  },
  "endereco-interno": {
    titulo: "O endereço aponta para uma rede interna",
    comoResolver:
      "A foto precisa estar publicada na internet. Endereços como localhost ou 192.168.x.x só funcionam dentro da própria empresa.",
  },
  "nao-respondeu": {
    titulo: "O endereço não respondeu",
    comoResolver: "Abrir o link no navegador: pode estar fora do ar, protegido por senha ou muito lento.",
  },
  "tipo-nao-e-imagem": {
    titulo: "O endereço devolve uma página, não uma imagem",
    comoResolver:
      "Costuma ser o link da PÁGINA do produto no lugar do link da FOTO. Clicar com o botão direito na imagem e copiar o endereço dela.",
  },
  "grande-demais": {
    titulo: "A foto passa de 10 MB",
    comoResolver: "Enviar uma versão menor. Foto de produto raramente precisa de mais de 1 MB.",
  },
  "nao-e-imagem-de-verdade": {
    titulo: "O arquivo não é uma imagem",
    comoResolver:
      "O endereço até responde, mas o conteúdo não é foto — pode ser um arquivo corrompido ou com a extensão trocada.",
  },
};

export function FotosRecusadas({ fotos }: { fotos: FotoRecusada[] }) {
  if (!fotos.length) return null;

  // Agrupado por MOTIVO, e não em lista corrida: cem produtos com o mesmo
  // problema são um recado só para a loja, não cem.
  const porMotivo = new Map<string, FotoRecusada[]>();
  for (const f of fotos) {
    const lista = porMotivo.get(f.motivo) ?? [];
    lista.push(f);
    porMotivo.set(f.motivo, lista);
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <div className="mb-1 flex items-center gap-2">
        <ImageOff className="h-4 w-4 text-amber-600" />
        <h2 className="font-semibold text-slate-900">Fotos que não entraram ({fotos.length})</h2>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Os produtos abaixo <strong>estão no site</strong> — só ficaram sem imagem. A linha some sozinha assim que a
        loja corrigir e enviar de novo.
      </p>

      <div className="space-y-3">
        {[...porMotivo.entries()].map(([motivo, itens]) => {
          const e = EXPLICACAO[motivo] ?? { titulo: motivo, comoResolver: "" };
          return (
            <div key={motivo} className="rounded-xl border border-amber-100 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{e.titulo}</h3>
                <span className="text-xs text-slate-400">
                  {itens.length} produto{itens.length > 1 ? "s" : ""}
                </span>
              </div>
              {e.comoResolver && <p className="mt-1 text-xs text-slate-500">{e.comoResolver}</p>}

              <ul className="mt-2 space-y-1">
                {itens.slice(0, 5).map((f) => (
                  <li key={f.externalId} className="flex flex-wrap items-baseline gap-2 text-xs">
                    <code className="rounded bg-slate-100 px-1 text-slate-700">{f.externalId}</code>
                    {f.url && <span className="min-w-0 flex-1 truncate text-slate-400">{f.url}</span>}
                  </li>
                ))}
                {itens.length > 5 && (
                  <li className="text-xs text-slate-400">e mais {itens.length - 5}…</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
