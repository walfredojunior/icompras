"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";

// O ENDEREÇO DO MANUAL, PRONTO PARA MANDAR PARA A LOJA.
//
// Nasceu de um pedido concreto (05/08/2026): "colocar essa informação do link
// para cópia e poder enviar pra outra pessoa por WhatsApp". O caminho real é
// o dono conversando com o dono da loja pelo celular — então o botão de enviar
// já leva o texto escrito, e não só a URL solta.

export default function LinkDoManual({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  const recado =
    `Manual da API do iCompras (para enviar seus produtos e preços):\n${url}\n\n` +
    `O formato é o mesmo do Compras Paraguai — se você já envia para lá, ` +
    `basta trocar o endereço e o token.`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // navigator.clipboard não existe fora de HTTPS e em navegador antigo.
      // Selecionar o texto deixa o Ctrl+C funcionando, que é o que a pessoa
      // faria de qualquer jeito.
      const campo = document.getElementById("url-manual") as HTMLInputElement | null;
      campo?.select();
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const botao =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition";

  return (
    <div className="space-y-3">
      <input
        id="url-manual"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copiar} className={`${botao} bg-brand-navy text-white hover:opacity-90`}>
          {copiado ? <Check size={15} /> : <Copy size={15} />}
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(recado)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${botao} bg-[#25D366] text-white hover:opacity-90`}
        >
          <MessageCircle size={15} />
          Enviar por WhatsApp
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${botao} border border-slate-200 text-slate-600 hover:bg-slate-50`}
        >
          <ExternalLink size={15} />
          Abrir
        </a>
      </div>
    </div>
  );
}
