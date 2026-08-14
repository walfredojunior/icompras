import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { registrarCliqueLoja } from "@/lib/analytics";

// Saída contada para a loja.
//
// O visitante clica no site ou no WhatsApp da loja e passa por aqui: contamos
// e mandamos adiante. É esse número que permite dizer ao lojista "o iCompras
// te enviou N visitantes este mês".
//
// Fica fora de [locale] de propósito: é um redirecionamento, não uma página.

// ⛔ NENHUM CLIQUE PODE TERMINAR NA FONTE. Regra do dono, 12/08/2026:
// **"nunca um produto deve abrir uma página do comprasparaguai"**. É de onde
// coletamos os preços; mandar nosso visitante para lá é entregar o cliente ao
// concorrente. Hoje nenhum link leva para lá — conferido nos 206.502 endereços
// de saída — mas isso é o estado dos DADOS, e dado muda a cada coleta. Isto
// aqui é a trava que não depende de os dados estarem limpos.
//
// ⚠ COMPARA O DOMÍNIO, NÃO O TEXTO. Existe um endereço legítimo do primeshop
// com "comprasparaguai" escrito no meio do caminho (a loja bagunçou o slug):
//   primeshop.com.py/shop/.../campainha-...-fjhttps-www-comprasparaguai-com-br-...
// Uma busca por texto bloquearia esse link de loja de verdade. Quem decide é o
// domínio, e só ele.
function naoPodeSerAFonte(endereco: string | null): string | null {
  if (!endereco) return null;
  try {
    const dominio = new URL(endereco).hostname.toLowerCase();
    // Pega comprasparaguai.com.br, www., e qualquer subdomínio — sem pegar um
    // domínio diferente que apenas contenha o nome (ex.: "naocomprasparaguai").
    if (dominio === "comprasparaguai.com.br" || dominio.endsWith(".comprasparaguai.com.br")) return null;
    if (dominio === "comprasparaguai.com" || dominio.endsWith(".comprasparaguai.com")) return null;
    return endereco;
  } catch {
    return null; // endereço inválido não vira redirecionamento
  }
}
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storeId = Number(id);
  const q = new URL(req.url).searchParams;
  const pedido = q.get("para");
  const alvo = pedido === "whatsapp" ? "whatsapp" : pedido === "produto" ? "produto" : "site";
  // O NÚMERO da oferta, nunca o endereço.
  //
  // Seria mais simples aceitar `?destino=https://...` e redirecionar. Seria
  // também um redirecionador aberto: qualquer um poderia mandar
  // `icompras.com.py/ir/loja/1?destino=<site falso>`, e o golpe usaria o nosso
  // domínio como fachada. Recebendo o id, o endereço sai do nosso banco.
  const ofertaId = Number(q.get("oferta"));

  // Volta para a home RELATIVA, não montada a partir de `req.url`.
  //
  // Atrás da Cloudflare + nginx o app se enxerga como 127.0.0.1:3000, então a
  // origem daqui de dentro não é a que a pessoa está vendo — usá-la mandava o
  // visitante para "localhost:3000". Aqui isso quase nunca aparecia (o destino
  // costuma ser o site externo da loja), mas o caminho de volta tinha o mesmo
  // defeito que quebrou o clique de banner em 04/08/2026.
  const casa = new NextResponse(null, { status: 302, headers: { Location: "/" } });

  if (!Number.isFinite(storeId) || storeId <= 0) return casa;

  const rows = await pool.query("SELECT external_url, phone FROM store WHERE id = ? LIMIT 1", [storeId]);
  if (!rows.length) return casa;

  // O produto exato na loja, quando pedido e quando temos.
  //
  // O `AND store_id = ?` não é redundante: sem ele, um id de oferta de OUTRA
  // loja passaria, e o clique seria contado para a loja errada.
  let doProduto: string | null = null;
  if (alvo === "produto" && Number.isFinite(ofertaId) && ofertaId > 0) {
    const of = await pool.query("SELECT store_url FROM offer WHERE id = ? AND store_id = ? LIMIT 1", [
      ofertaId,
      storeId,
    ]);
    doProduto = of.length ? of[0].store_url || null : null;
  }

  const destino =
    alvo === "whatsapp"
      ? rows[0].phone
        ? `https://wa.me/${String(rows[0].phone).replace(/\D/g, "")}`
        : null
      : // Rede de proteção: sem o link do produto, a home da loja. O visitante
        // procura de novo — chato, mas melhor que um botão que não leva a lugar
        // nenhum. Só cai na nossa home quando a loja também não tem site.
        naoPodeSerAFonte(doProduto) || naoPodeSerAFonte(rows[0].external_url) || null;

  if (!destino) return casa;

  // "produto" conta como "site": para o lojista as duas coisas são a mesma —
  // um visitante que o iCompras mandou para a loja dele. Separar exigiria
  // migration na coluna e quebraria a comparação com os meses anteriores.
  await registrarCliqueLoja(storeId, alvo === "whatsapp" ? "whatsapp" : "site");
  // 302: é uma saída pontual, não deve ficar guardada pelo navegador.
  return NextResponse.redirect(destino, 302);
}
