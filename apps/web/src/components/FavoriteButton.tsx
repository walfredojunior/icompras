"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

// Coração de favoritos, na página do produto.
//
// Fica no produto, não em cada oferta: as 45 lojas vendem o MESMO produto, e
// 45 corações fariam todos a mesma coisa. Guardar o produto é o que faz
// sentido — e da lista de favoritos dá para criar um alerta de preço.
export function FavoriteButton({
  productId,
  inicial,
  logado,
  labels,
}: {
  productId: number;
  inicial: boolean;
  logado: boolean;
  labels: { favorite: string; favorited: string; loginToFavorite: string };
}) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [pulso, setPulso] = useState(false);

  async function clicar() {
    if (!logado) {
      router.push("/entrar");
      return;
    }
    setOcupado(true);
    const antes = ativo;
    setAtivo(!antes); // responde na hora; desfaz se der erro
    if (!antes) {
      setPulso(true);
      setTimeout(() => setPulso(false), 320);
    }
    try {
      const r = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!r.ok) throw new Error();
      const j = await r.json();
      setAtivo(!!j.favorito);
    } catch {
      setAtivo(antes);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      onClick={clicar}
      disabled={ocupado}
      title={logado ? (ativo ? labels.favorited : labels.favorite) : labels.loginToFavorite}
      aria-pressed={ativo}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition disabled:opacity-60 ${
        ativo
          ? "border-red-200 bg-red-50 text-red-600"
          : "border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-500"
      }`}
    >
      <Heart
        className={`h-4 w-4 transition-transform ${ativo ? "fill-current" : ""} ${pulso ? "scale-125" : "scale-100"}`}
      />
      <span className="hidden sm:inline">{ativo ? labels.favorited : labels.favorite}</span>
    </button>
  );
}
