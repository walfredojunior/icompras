"use client";

// CORAÇÕES VOANDO ao marcar um favorito.
//
// Pedido dele em 15/08/2026: *"colocar um efeito quando marco um favorito, de
// voar corações... tipo no tiktok"*. É enfeite, e enfeite tem uma regra: se
// atrapalhar o uso, sai.
//
// ⚠ FEITO DIRETO NO DOM, NÃO EM ESTADO DO REACT. Animar 15 elementos a 60
// quadros por segundo com `useState` faria o React redesenhar a árvore inteira
// a cada quadro. Aqui os elementos são criados uma vez, a animação roda no
// motor de CSS (que a placa de vídeo faz sozinha) e eles se removem no fim.
// O React nem fica sabendo.
//
// 💡 SÓ `transform` E `opacity`. São as duas únicas propriedades que o
// navegador anima sem recalcular o desenho da página. Animar `top`/`left`
// custaria um recálculo de layout por quadro — é o que trava celular modesto,
// e 95% das visitas do iCompras são de telefone.

/** Quantos por vez. 15 roda liso em aparelho fraco; 100 trava até bom aparelho. */
const QUANTOS_GRANDE = 14;
const QUANTOS_PEQUENO = 4;
/** Trava para o clique repetido não virar chuva de 75 corações. */
let rodando = false;

function querAnimacao(): boolean {
  // O sistema avisa quando a pessoa pediu "reduzir animações" — quem tem
  // enxaqueca ou vertigem depende disso. Uma linha, e evita causar mal-estar.
  if (typeof window === "undefined") return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

let estiloPosto = false;
function garantirEstilo() {
  if (estiloPosto || typeof document === "undefined") return;
  estiloPosto = true;
  const s = document.createElement("style");
  s.textContent = `
@keyframes icSobe {
  0%   { transform: translate3d(0,0,0) scale(.4) rotate(0deg); opacity: 0 }
  12%  { opacity: 1 }
  70%  { opacity: 1 }
  100% { transform: translate3d(var(--dx), var(--dy), 0) scale(var(--esc)) rotate(var(--giro)); opacity: 0 }
}
.ic-coracao {
  position: fixed;
  z-index: 60;
  /* ⚠ ESSENCIAL: o coração não pode roubar o toque. Sem isto, quem tentasse
     tocar em outra coisa enquanto eles sobem acertaria um coração. */
  pointer-events: none;
  will-change: transform, opacity;
  user-select: none;
  line-height: 1;
}`;
  document.head.appendChild(s);
}

/**
 * Solta os corações a partir de um elemento (normalmente o botão clicado).
 *
 * @param origem  de onde eles saem
 * @param grande  true na página do produto (gesto com peso),
 *                false nos cartões — quem varre uma lista adiciona vários
 *                seguidos, e o efeito cheio a cada clique cansa rápido.
 */
export function soltarCoracoes(origem: HTMLElement | null, grande = true) {
  if (!origem || !querAnimacao() || rodando) return;
  garantirEstilo();
  rodando = true;

  const r = origem.getBoundingClientRect();
  const x0 = r.left + r.width / 2;
  const y0 = r.top + r.height / 2;
  const quantos = grande ? QUANTOS_GRANDE : QUANTOS_PEQUENO;
  const feitos: HTMLElement[] = [];

  for (let i = 0; i < quantos; i++) {
    const e = document.createElement("div");
    e.className = "ic-coracao";

    // ⚠ SVG PRÓPRIO, NÃO EMOJI COM FILTRO DE COR.
    //
    // A primeira versão usava o emoji ❤️ com `hue-rotate(75deg)` para virar
    // verde. Na foto da tela o resultado era **verde-oliva amarelado** — sujo,
    // nada a ver com o verde da marca. `hue-rotate` gira o matiz de tudo, e o
    // vermelho do emoji tem sombreado e brilho que giram junto.
    //
    // Com SVG a cor é exatamente #2fa043 (a mesma dos preços do site), e o
    // desenho fica idêntico em iPhone, Android e computador — o emoji muda de
    // aparência conforme o aparelho.
    const carinha = grande && i % 5 === 2;
    const tam = grande ? 18 + Math.random() * 18 : 13 + Math.random() * 8;

    if (carinha) {
      // O 😍 fica como emoji mesmo: é colorido por natureza e seria trabalhoso
      // desenhar. Aparece em 1 de cada 5, só no efeito grande.
      e.textContent = "😍";
      e.style.fontSize = `${tam}px`;
    } else {
      const claro = i % 3 === 0;
      e.innerHTML =
        `<svg viewBox="0 0 24 24" width="${Math.round(tam)}" height="${Math.round(tam)}" fill="${claro ? "#2fa043" : "#23842f"}" aria-hidden="true">` +
        `<path d="M12 21s-7.5-4.7-9.6-9A5.6 5.6 0 0 1 12 6.1 5.6 5.6 0 0 1 21.6 12c-2.1 4.3-9.6 9-9.6 9z"/></svg>`;
    }

    e.style.left = `${x0 - tam / 2}px`;
    e.style.top = `${y0 - tam / 2}px`;

    // Cada um sobe por um caminho um pouco diferente — sem isso parecem um
    // bloco só subindo, que é o que dá aparência de coisa mal feita.
    const dx = (Math.random() - 0.5) * (grande ? 220 : 90);
    const dy = -(grande ? 170 + Math.random() * 190 : 80 + Math.random() * 60);
    e.style.setProperty("--dx", `${dx}px`);
    e.style.setProperty("--dy", `${dy}px`);
    e.style.setProperty("--esc", `${0.7 + Math.random() * 0.7}`);
    e.style.setProperty("--giro", `${(Math.random() - 0.5) * 90}deg`);

    const dur = (grande ? 1100 : 750) + Math.random() * 500;
    e.style.animation = `icSobe ${dur}ms cubic-bezier(.22,.7,.35,1) ${i * 22}ms forwards`;

    document.body.appendChild(e);
    feitos.push(e);
  }

  // Limpeza por tempo, não por evento de fim de animação: se a aba for para o
  // segundo plano no meio, o evento pode não disparar e os elementos ficariam
  // presos no documento para sempre.
  const total = (grande ? 1700 : 1300) + quantos * 22;
  window.setTimeout(() => {
    feitos.forEach((e) => e.remove());
    rodando = false;
  }, total);
}
