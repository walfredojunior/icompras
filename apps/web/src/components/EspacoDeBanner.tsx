import { BannerCarousel } from "./BannerCarousel";
import type { Banner } from "@/lib/banners";

// UM DOS TRÊS ESPAÇOS de banner da página (topo, meio ou fim) — 21/08/2026.
//
// ⚠ POR QUE TRÊS, E NÃO UM CARROSSEL. Antes todos os banners de uma categoria
// iam para um carrossel único no topo, revezando a cada 8 segundos. Isso tinha
// um defeito comercial: quem chegava em segundo só aparecia depois de 8s,
// quando a pessoa já havia rolado a página — vendiam-se dois espaços e
// entregava-se um. Com posições fixas, cada anunciante tem o lugar dele.
//
// 💡 O carrossel continua sendo usado DENTRO de cada espaço: se um dia houver
// mais de um banner no mesmo espaço e período (o que a trava impede hoje), ele
// não some da tela.

/**
 * Quantos produtos a lista precisa ter para o espaço aparecer.
 *
 * ⚠ MEDIDO ANTES DE ESCOLHER (21/08/2026): 92% das buscas devolvem 24+
 * resultados, então na prática quase nada é cortado. Mas nos 7% com poucos
 * resultados, três anúncios em volta de cinco produtos ficaria ridículo — e o
 * anunciante não perde nada relevante.
 */
/**
 * A proporção de cada espaço — e o tamanho de arte que o anunciante deve mandar.
 *
 * ⚠ O TOPO É UM CARTAZ; MEIO E FIM SÃO FAIXAS. O do topo abre a página e pode
 * ocupar espaço. Os outros dois entram NO MEIO DA LISTA de produtos: com a
 * mesma altura, empurrariam os produtos para baixo e atrapalhariam quem está
 * comparando preços.
 *
 * 💡 **818×137 (≈6:1) — a medida dele, decidida VENDO A TELA.**
 *
 * ⚠ FUI E VOLTEI NESTA DECISÃO, e a lição é o motivo. Eu havia argumentado por
 * 4:1 com uma conta de altura em pixels: em 6:1 a faixa fica com ~60px no
 * celular e o texto de uma arte carregada vira borrão. Ele testou no site
 * rodando e disse que 4:1 **ficou grande** — a faixa competia com os produtos.
 *
 * 💡 A conta estava certa e a conclusão errada: o problema de legibilidade é da
 * ARTE (texto longo em diagonal), não da proporção. Faixa fina com arte simples
 * — logo grande e três ou quatro palavras — lê bem em 60px. **Quem olha a tela
 * decide melhor que quem calcula a altura.**
 */
export const PROPORCAO: Record<"topo" | "meio" | "fim", string> = {
  topo: "858/375",
  meio: "818/137",
  fim: "818/137",
};

/** O tamanho de arte a pedir ao anunciante, por espaço. */
export const TAMANHO_RECOMENDADO: Record<"topo" | "meio" | "fim", string> = {
  topo: "858 × 375",
  meio: "818 × 137",
  fim: "818 × 137",
};

export const MINIMO_PARA_ESPACO: Record<"topo" | "meio" | "fim", number> = {
  topo: 0, // o topo sempre aparece: é o espaço mais caro e não depende da lista
  meio: 12,
  fim: 6,
};

export function EspacoDeBanner({
  banners,
  slot,
  totalNaPagina,
  rotuloPublicidade,
}: {
  banners: Banner[];
  slot: "topo" | "meio" | "fim";
  totalNaPagina: number;
  rotuloPublicidade: string;
}) {
  if (!banners.length) return null;
  if (totalNaPagina < MINIMO_PARA_ESPACO[slot]) return null;

  // ⚠ ETIQUETA DE PUBLICIDADE — não é enfeite nem exigência legal apenas.
  // O iCompras se apresenta como comparador NEUTRO, e o rodapé avisa que não
  // há parceiros. Triplicar o espaço publicitário sem identificar o que é pago
  // contradiz esse aviso e gasta a confiança que faz a pessoa voltar.
  // O campo `is_paid` já existia no banco desde sempre e nunca aparecia na tela.
  const pago = banners.some((b) => Number(b.is_paid) === 1);

  return (
    <div className={slot === "topo" ? "mb-6" : "my-6"}>
      {pago && (
        <p className="mb-1 text-right text-[10px] uppercase tracking-wide text-slate-400">
          {rotuloPublicidade}
        </p>
      )}
      {/* Só o topo carrega de imediato: é o único visível sem rolar, e 95% de
          quem acessa está no celular. Ver o comentário em BannerCarousel. */}
      <BannerCarousel banners={banners as never[]} lazy={slot !== "topo"} proporcao={PROPORCAO[slot]} />
    </div>
  );
}
