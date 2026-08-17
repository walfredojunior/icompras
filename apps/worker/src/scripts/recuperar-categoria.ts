// RECUPERAR A CATEGORIA DOS PRODUTOS QUE ENTRARAM SEM ELA.
//
// ====================================================================
// O PROBLEMA
// ====================================================================
// 142.507 produtos (de 334.026) estão sem categoria — não aparecem em
// nenhuma navegação por categoria, só na busca. Quase todos entraram pelo
// MAPA (sitemap), e a unidade de coleta do mapa é "@mapa/1..4", que mistura
// tudo: não existe "a categoria da página onde ele foi achado". Sobrava
// adivinhar pelo nome do produto, e adivinhar erra feio ("Secador Dyson
// Airwrap" → informática).
//
// ⚠ NÃO CONFUNDIR com a coluna `product.source_category`: apesar do nome,
// ela guarda a UNIDADE DE COLETA ("mapa", "diversos"), não a categoria da
// fonte. Conferido em 16/08/2026: dos 134.544 sem categoria que a têm
// preenchida, 133.856 dizem literalmente "mapa". Ela não ajuda aqui.
//
// ====================================================================
// A SOLUÇÃO
// ====================================================================
// A fonte DECLARA a categoria nos dados estruturados de cada página
// (`"category": "Cosmético"`), e **507 das 509 categorias dela têm o mesmo
// nome das nossas** — a nossa taxonomia nasceu dela. Então não é adivinhar:
// é ler o que está escrito.
//
// O coletor já passou a ler isso (crawl.ts, 16/08/2026), o que estanca a
// entrada. Este processo cuida do que já estava acumulado, que o coletor só
// consertaria quando revisitasse cada um — dias de espera.
//
// ====================================================================
// COMO SE COMPORTA
// ====================================================================
//   • Vai devagar de propósito. A fonte é de terceiros e o coletor já está
//     usando o mesmo caminho — este processo anda em segundo plano, num
//     ritmo que não atrapalha nem chama atenção.
//   • Escuta a fonte: 429/503 = espera; 403 seguidos = PARA (a fonte fechou
//     a porta, insistir vira bloqueio definitivo).
//   • Pode ser interrompido a qualquer momento e continua de onde parou.
//   • ⚠ GRAVA O QUE MUDOU em `alteracao_massa` ANTES de mudar. Ontem o
//     categorizador por IA errou em massa e só deu para recuperar 192 de
//     500 produtos, porque escreveu por cima sem deixar rastro. Aqui,
//     desfazer é uma consulta.
//   • Na dúvida, NÃO grava categoria. Se a fonte declara uma que não existe
//     aqui, o produto continua sem categoria — é melhor do que empurrar para
//     uma parecida.
//   • ⚠ GRAVA O QUE A FONTE DECLAROU em `produto_categoria_fonte`, mesmo
//     quando não dá para usar. A rodada de 16/08 só CONTOU ("5.960 são
//     Diversos") e o número, sozinho, não deixou agir: para saber QUAIS
//     produtos eram, seria preciso visitar as 26 mil páginas de novo. Agora a
//     resposta fica no banco, e a decisão sobre eles não custa mais nenhuma
//     visita à fonte.
//
//   npm run recuperar-categoria -w @icompras/worker -- --simular
//   npm run recuperar-categoria -w @icompras/worker -- --limite=200
//   npm run recuperar-categoria -w @icompras/worker
//   npm run recuperar-categoria -w @icompras/worker -- --do-inicio
//   npm run recuperar-categoria -w @icompras/worker -- --desfazer=<lote>
import "../env.js";
import { pool } from "@icompras/db";
// ⚠ A leitura da categoria declarada mora num arquivo SÓ, compartilhado com o
// coletor. Antes estava copiada nos dois, e duas leituras diferentes do mesmo
// campo fariam o produto trocar de categoria conforme quem passasse por último.
import { lerCategoriaDaFonte, indexarCategorias, casarCategoria } from "../categoriaDaFonte.js";

const PROCESSO = "recuperar-categoria";
const BASE = "https://www.comprasparaguai.com.br";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

// RITMO. 2 páginas por segundo, 2 de cada vez.
//
// 💡 POR QUE TÃO DEVAGAR. Este processo não tem pressa: ninguém está esperando
// na tela. O coletor está no mesmo caminho ao mesmo tempo, e o que decide se a
// fonte nos bloqueia é o TOTAL das duas coisas somadas, não o de cada uma. Em
// 2/s, os 142 mil levam cerca de 20 horas — o que é irrelevante para um acervo
// que já está assim há semanas, e é a diferença entre continuar coletando e
// levar um bloqueio que custaria dias.
const RPS = Number(process.env.RECUP_RPS ?? 2);
const PARALELO = Number(process.env.RECUP_PARALELO ?? 2);
const LOTE = 500;

const simular = process.argv.includes("--simular");
const limite = Number(process.argv.find((a) => a.startsWith("--limite="))?.split("=")[1] ?? 0);
const desfazer = process.argv.find((a) => a.startsWith("--desfazer="))?.split("=")[1];
// Recomeçar do primeiro produto em vez de continuar de onde parou. Serve
// quando a REGRA mudou (uma correspondência nova, uma categoria criada) e vale
// reconferir quem já foi visitado — sem isso, o processo acharia que terminou.
const doInicio = process.argv.includes("--do-inicio");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// ESCUTAR A FONTE.
//
// Mesma disciplina do coletor: 429 é sobre o NOSSO ritmo (freia), 503 é
// problema DELES (espera, sem se castigar), 403 é "você não entra" — e aí
// insistir é o que transforma aviso em bloqueio permanente.
// ---------------------------------------------------------------------------
let freioAte = 0;
let recusas403 = 0;
let parar = false;
const PARAR_APOS_403 = 3;

async function baixar(url: string): Promise<string | null> {
  for (let tentativa = 0; tentativa < 3 && !parar; tentativa++) {
    const falta = freioAte - Date.now();
    if (falta > 0) await sleep(falta);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "es,pt;q=0.8" },
        signal: AbortSignal.timeout(30000),
      });

      if (res.status === 429 || res.status === 503) {
        const h = Number(res.headers.get("retry-after"));
        const espera = isFinite(h) && h > 0 ? Math.min(h * 1000, 300000) : 60000;
        freioAte = Date.now() + espera;
        console.log(`  ⏸ fonte pediu ${Math.round(espera / 1000)}s de espera (${res.status})`);
        continue;
      }

      if (res.status === 403) {
        recusas403++;
        if (recusas403 >= PARAR_APOS_403) {
          // Não troca de saída nem insiste: só para. Quem sabe trocar de IP é
          // o coletor, que tem proxy configurado. Aqui, parar é o certo.
          console.log(`\n  🛑 ${recusas403} recusas de acesso seguidas — a fonte fechou a porta.`);
          console.log("     Parando por aqui. O que já foi feito está gravado; é só rodar de novo depois.");
          parar = true;
        }
        return null;
      }

      // Resposta boa zera a contagem: 403 esparsos são páginas específicas,
      // não bloqueio. O que importa é a SEQUÊNCIA.
      if (res.ok) {
        recusas403 = 0;
        return await res.text();
      }
      // 404 e afins: a página sumiu da fonte. Não é erro nosso, não insiste.
      if (res.status === 404 || res.status === 410) return null;
    } catch {
      // Rede oscilou ou estourou o tempo — tenta de novo, com pausa crescente.
      await sleep(1000 * (tentativa + 1));
    }
  }
  return null;
}

interface Alvo {
  id: number;
  nome: string;
  url: string;
}

// ---------------------------------------------------------------------------
// ONDE MORA CADA PRODUTO NA FONTE.
//
// ⚠ NÃO DÁ PARA USAR `offer.url`. Parece o caminho óbvio, mas aquele endereço
// é o da LOJA (shoppingchina.com.py, nissei.com, romapy.com…) — é o link de
// "ir comprar". Dos 142 mil sem categoria, só 123 tinham endereço da fonte.
// Descoberto testando, em 16/08/2026.
//
// O caminho certo é o MAPA DO SITE (sitemap): 179 arquivos, ~290 mil endereços
// no formato `/{nome-do-produto}__{numero}/`. Baixado UMA vez e guardado em
// disco; a partir daí é consulta local, sem custo nenhum para a fonte.
// ---------------------------------------------------------------------------
const ARQUIVO_MAPA = new URL("../../../../.cache/mapa-fonte.txt", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const VALIDADE_MAPA_DIAS = 7;

interface Mapa {
  exato: Map<string, string>;
  /** Chave "frouxa" → endereço, ou null quando dois produtos disputam a chave. */
  reduzido: Map<string, string | null>;
}

/**
 * CHAVE FROUXA, para casar apesar da escrita.
 *
 * O nosso nome de produto é normalizado e o da fonte não: o mesmo sérum é
 * `…-tightening-de-30-ml` lá e `…-tightening-30ml` aqui. Comparar letra por
 * letra achava só 70%. Tirando as palavras de ligação e as separações, os dois
 * viram a mesma coisa e a localização sobe para 91% (medido nos 142 mil).
 */
const LIGACOES = new Set(["de", "da", "do", "das", "dos", "com", "para", "e", "a", "o", "em", "no", "na", "por"]);
const chaveFrouxa = (slug: string) =>
  slug
    .toLowerCase()
    .split("-")
    .filter((t) => t && !LIGACOES.has(t))
    .join("");

function enderecoDe(mapa: Mapa, slug: string): string | null {
  const exato = mapa.exato.get(slug.toLowerCase());
  if (exato) return exato;
  // `?? null` porque a chave frouxa guarda null de propósito quando é ambígua:
  // dois produtos diferentes com a mesma chave, e aí não dá para escolher.
  return mapa.reduzido.get(chaveFrouxa(slug)) ?? null;
}

async function carregarMapa(): Promise<Mapa> {
  const fs = await import("node:fs");
  let idade = Infinity;
  try {
    idade = (Date.now() - fs.statSync(ARQUIVO_MAPA).mtimeMs) / 86400000;
  } catch {
    /* ainda não existe */
  }

  if (idade > VALIDADE_MAPA_DIAS) {
    console.log(`Baixando o mapa do site (${idade === Infinity ? "primeira vez" : `${Math.round(idade)} dias de idade`})...`);
    fs.mkdirSync(ARQUIVO_MAPA.replace(/[/\\][^/\\]+$/, ""), { recursive: true });
    const indice = await baixar(`${BASE}/sitemap.xml`);
    if (!indice) throw new Error("não consegui abrir o mapa do site");
    const mapas = [...indice.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const saida = fs.createWriteStream(ARQUIVO_MAPA);
    let total = 0;
    for (let i = 0; i < mapas.length; i++) {
      const xml = await baixar(mapas[i]);
      if (xml) {
        for (const m of xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)) {
          saida.write(m[1] + "\n");
          total++;
        }
      }
      if ((i + 1) % 40 === 0) console.log(`  ${i + 1}/${mapas.length} arquivos · ${total.toLocaleString("pt-BR")} endereços`);
      await sleep(600);
    }
    await new Promise((r) => saida.end(r));
    console.log(`  mapa guardado: ${total.toLocaleString("pt-BR")} endereços\n`);
  }

  const mapa: Mapa = { exato: new Map(), reduzido: new Map() };
  for (const linha of fs.readFileSync(ARQUIVO_MAPA, "utf8").split("\n")) {
    const m = linha.match(/\/([a-z0-9-]+)__(\d+)\/?$/i);
    if (!m) continue;
    const s = m[1].toLowerCase();
    if (!mapa.exato.has(s)) mapa.exato.set(s, linha);
    const k = chaveFrouxa(s);
    // Segunda ocorrência da mesma chave frouxa = ambígua, e ambígua não serve.
    if (mapa.reduzido.has(k)) mapa.reduzido.set(k, null);
    else mapa.reduzido.set(k, linha);
  }
  console.log(`Mapa: ${mapa.exato.size.toLocaleString("pt-BR")} produtos na fonte.`);
  return mapa;
}

async function main(): Promise<void> {
  if (desfazer) return void (await desfazerLote(desfazer));

  // As nossas categorias. Só grava se o que a fonte disser existir AQUI.
  const cats: Array<{ id: number; slug: string }> = await pool.query("SELECT id, slug FROM category");
  const idPorSlug = new Map(cats.map((c) => [c.slug, Number(c.id)]));
  const indice = indexarCategorias(idPorSlug);
  console.log(`${idPorSlug.size} categorias conhecidas.`);

  // ONDE PAREI. Sem isto, uma interrupção às 18h faria recomeçar do produto 1
  // e refazer 100 mil páginas já visitadas.
  const est: any[] = await pool.query("SELECT * FROM processo_estado WHERE nome = ?", [PROCESSO]);
  let posicao = doInicio ? 0 : est.length ? Number(est[0].posicao) : 0;
  let feitos = doInicio ? 0 : est.length ? Number(est[0].feitos) : 0;
  let alterados = doInicio ? 0 : est.length ? Number(est[0].alterados) : 0;
  let falhas = doInicio ? 0 : est.length ? Number(est[0].falhas) : 0;
  // Um lote por rodada, com a data e hora: dá para desfazer a de hoje sem
  // tocar na de ontem.
  const lote = est.length && est[0].lote && posicao > 0 ? String(est[0].lote) : marcaDeLote();

  if (doInicio) console.log(`Recomeçando do primeiro produto, lote ${lote}.`);
  else if (posicao > 0) console.log(`Continuando de onde parou (produto ${posicao}), lote ${lote}.`);
  else console.log(`Lote ${lote}.`);
  if (simular) console.log("⚠ SIMULAÇÃO — nada será gravado.\n");

  const mapa = await carregarMapa();

  const desconhecidas = new Map<string, number>();
  let naoLocalizados = 0;
  const inicio = Date.now();
  let semDeclaracao = 0;
  // Quantos foram achados por cada caminho de correspondência. Serve para ver
  // se as regras menos óbvias (pontuação, "outros-") estão pagando o preço de
  // existir, e para desconfiar delas se um dia dispararem.
  const porComo = new Map<string, number>();

  while (!parar) {
    // Pega em blocos, sempre para a frente pelo id.
    const linhas: Array<{ id: number; slug: string; nome: string }> = await pool.query(
      `SELECT id, slug, canonical_name AS nome
         FROM product
        WHERE category_id IS NULL AND id > ?
        ORDER BY id
        LIMIT ?`,
      [posicao, LOTE],
    );
    if (!linhas.length) break;

    // Traduz cada produto no endereço dele na fonte. Quem não estiver no mapa
    // fica de fora desta rodada — sem chute.
    const alvos: Alvo[] = [];
    for (const l of linhas) {
      const url = enderecoDe(mapa, l.slug);
      if (url) alvos.push({ id: Number(l.id), nome: l.nome, url });
      else naoLocalizados++;
    }
    posicao = Number(linhas[linhas.length - 1].id);
    if (!alvos.length) {
      // Bloco inteiro fora do mapa: registra o avanço e segue, senão a próxima
      // volta pediria os mesmos produtos para sempre.
      if (!simular) {
        await pool.query(
          `INSERT INTO processo_estado (nome, posicao, feitos, alterados, falhas, lote)
           VALUES (?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE posicao=VALUES(posicao), feitos=VALUES(feitos),
             alterados=VALUES(alterados), falhas=VALUES(falhas), lote=VALUES(lote)`,
          [PROCESSO, posicao, feitos, alterados, falhas, lote],
        );
      }
      continue;
    }

    // Fatia o bloco entre os buscadores, respeitando o ritmo combinado.
    const intervalo = Math.round((1000 * PARALELO) / RPS);
    const fila = [...alvos];
    const achados: Array<{ alvo: Alvo; slug: string; cru: string }> = [];
    // O QUE A FONTE DECLAROU, para TODO produto cuja página abriu — inclusive
    // (e principalmente) quando não deu para usar. `declarada: null` quer dizer
    // "a página abriu e não declara categoria", que é diferente de "não fomos
    // olhar" e é a distinção que faltava depois da rodada de 16/08.
    const declaracoes: Array<{ id: number; declarada: string | null }> = [];

    await Promise.all(
      Array.from({ length: PARALELO }, async () => {
        while (fila.length && !parar) {
          const alvo = fila.shift()!;
          const t0 = Date.now();
          const html = await baixar(alvo.url);
          feitos++;
          if (html) {
            const slug = lerCategoriaDaFonte(html);
            declaracoes.push({ id: alvo.id, declarada: slug });
            const casou = casarCategoria(slug, indice);
            if (!slug) semDeclaracao++;
            else if (casou) {
              achados.push({ alvo, slug: casou.slug, cru: slug });
              porComo.set(casou.como, (porComo.get(casou.como) ?? 0) + 1);
            } else desconhecidas.set(slug, (desconhecidas.get(slug) ?? 0) + 1);
          } else if (!parar) falhas++;
          const gasto = Date.now() - t0;
          if (gasto < intervalo) await sleep(intervalo - gasto);
        }
      }),
    );

    // A DECLARAÇÃO É GRAVADA SEMPRE, e antes da categoria. Mesmo que o
    // processo morra no comando seguinte, o trabalho de ter ido à fonte não se
    // perde — que foi exatamente o que se perdeu em 16/08.
    if (!simular && declaracoes.length) {
      const porDeclaracao = new Map<string | null, number[]>();
      for (const d of declaracoes) {
        const atual = porDeclaracao.get(d.declarada);
        if (atual) atual.push(d.id);
        else porDeclaracao.set(d.declarada, [d.id]);
      }
      for (const [declarada, ids] of porDeclaracao) {
        for (let i = 0; i < ids.length; i += 200) {
          const fatia = ids.slice(i, i + 200);
          await pool.query(
            `INSERT INTO produto_categoria_fonte (product_id, declarada, conferida_em)
             VALUES ${fatia.map(() => "(?,?,NOW())").join(",")}
             ON DUPLICATE KEY UPDATE declarada = VALUES(declarada), conferida_em = VALUES(conferida_em)`,
            fatia.flatMap((id) => [id, declarada]),
          );
        }
      }
    }

    if (!simular && achados.length) {
      // ⚠ A MARCA VEM ANTES DA MUDANÇA. Se o processo morrer entre as duas,
      // sobra uma marca a mais (inofensiva) em vez de uma mudança sem marca
      // (irreversível). Foi a falta disso que deixou 308 produtos sem volta
      // no episódio do categorizador por IA.
      await pool.query(
        `INSERT INTO alteracao_massa
           (processo, lote, tabela, registro_id, campo, valor_antes, valor_depois, origem)
         VALUES ${achados.map(() => "(?,?,'product',?,'category_id',NULL,?,?)").join(",")}`,
        achados.flatMap((a) => [PROCESSO, lote, a.alvo.id, String(idPorSlug.get(a.slug)), `fonte:${a.cru}`]),
      );
      // Agrupa por categoria: 500 produtos viram ~20 comandos, não 500.
      const porCat = new Map<number, number[]>();
      for (const a of achados) {
        const cid = idPorSlug.get(a.slug)!;
        (porCat.get(cid) ?? porCat.set(cid, []).get(cid)!).push(a.alvo.id);
      }
      for (const [cid, ids] of porCat) {
        // O `AND category_id IS NULL` protege contra corrida: se o coletor
        // categorizou este produto enquanto baixávamos a página, o dele vale
        // (é mais recente) e não sobrescrevemos.
        await pool.query(
          `UPDATE product SET category_id = ? WHERE id IN (${ids.map(() => "?").join(",")}) AND category_id IS NULL`,
          [cid, ...ids],
        );
      }
    }

    alterados += achados.length;

    if (!simular) {
      await pool.query(
        `INSERT INTO processo_estado (nome, posicao, feitos, alterados, falhas, lote)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE posicao=VALUES(posicao), feitos=VALUES(feitos),
           alterados=VALUES(alterados), falhas=VALUES(falhas), lote=VALUES(lote)`,
        [PROCESSO, posicao, feitos, alterados, falhas, lote],
      );
    }

    const min = (Date.now() - inicio) / 60000;
    const porMin = feitos / Math.max(min, 0.1);
    console.log(
      `  ${feitos.toLocaleString("pt-BR")} conferidos · ${alterados.toLocaleString("pt-BR")} categorizados` +
        ` · ${falhas} sem resposta · ${Math.round(porMin)}/min`,
    );
    if (limite && feitos >= limite) {
      console.log(`\nLimite de ${limite} atingido — parando (foi um teste).`);
      break;
    }
  }

  console.log(`\n${"=".repeat(58)}`);
  console.log(`Conferidos:    ${feitos.toLocaleString("pt-BR")}`);
  console.log(`Categorizados: ${alterados.toLocaleString("pt-BR")}`);
  console.log(`Sem declaração na fonte: ${semDeclaracao.toLocaleString("pt-BR")}`);
  console.log(`Sem resposta:  ${falhas.toLocaleString("pt-BR")}`);
  console.log(`Não achados no mapa da fonte: ${naoLocalizados.toLocaleString("pt-BR")}`);
  if (naoLocalizados) {
    // Quase sempre produtos que entraram DEPOIS do mapa que temos guardado.
    // O coletor os categoriza sozinho quando passar por eles, agora que lê a
    // categoria declarada — não é preciso fazer nada.
    console.log("  (entraram depois do mapa; o coletor cuida deles ao revisitar)");
  }
  if (porComo.size) {
    // "exata" é o caminho normal. Os outros dois são consertos de encaixe, e
    // convém vê-los: se um deles crescer muito, é sinal de que a nossa árvore
    // se afastou da árvore da fonte e o certo passa a ser sincronizá-la.
    const rotulo: Record<string, string> = {
      exata: "nome igual ao nosso",
      pontuacao: "só a pontuação diferia (ex.: Câmera/Filmadora)",
      outros: "encaixou na versão «outros …» da mesma família",
    };
    console.log("\nComo cada um encontrou a nossa categoria:");
    for (const [como, n] of [...porComo].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(6)}  ${rotulo[como] ?? como}`);
    }
  }
  if (!simular) console.log(`\nPara desfazer tudo desta rodada:  -- --desfazer=${lote}`);
  if (desconhecidas.size) {
    // Estas são as categorias que a fonte tem e nós não. Não é erro: é a
    // lista de candidatas a criar, com quantos produtos cada uma traria.
    //
    // 💡 Quem manda aqui é `diversos`, e ela NÃO é candidata a nada: é a
    // gaveta de bagunça da própria fonte (a trilha da página dela diz
    // "Início › Categorias › Diversos"). Esses produtos ficam gravados em
    // `produto_categoria_fonte.declarada = 'diversos'` e o destino deles é
    // decisão nossa, não dela.
    console.log(`\nCategorias da fonte que não existem aqui (${desconhecidas.size}):`);
    for (const [slug, n] of [...desconhecidas].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
      console.log(`  ${String(n).padStart(6)}  ${slug}`);
    }
  }
  await pool.end();
}

/** Marca do lote: data e hora, legível. Ex.: 20260816-0312 */
function marcaDeLote(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * DESFAZER uma rodada inteira, produto por produto, de volta ao valor de antes.
 *
 * Só volta o que AINDA está como este processo deixou. Se depois disso alguém
 * (ou o coletor) mudou a categoria de novo, essa mudança mais recente é
 * preservada — desfazer não pode atropelar quem veio depois.
 */
async function desfazerLote(lote: string): Promise<void> {
  const linhas: any[] = await pool.query(
    "SELECT registro_id, valor_antes, valor_depois FROM alteracao_massa WHERE processo=? AND lote=?",
    [PROCESSO, lote],
  );
  if (!linhas.length) {
    console.log(`Nenhuma alteração registrada no lote "${lote}".`);
    const outros: any[] = await pool.query(
      "SELECT lote, COUNT(*) n, MIN(criado_em) q FROM alteracao_massa WHERE processo=? GROUP BY lote ORDER BY q DESC LIMIT 10",
      [PROCESSO],
    );
    if (outros.length) {
      console.log("\nLotes existentes:");
      for (const o of outros) console.log(`  ${o.lote}  ${Number(o.n).toLocaleString("pt-BR")} produtos  (${o.q})`);
    }
    return void (await pool.end());
  }
  console.log(`Desfazendo ${linhas.length.toLocaleString("pt-BR")} alterações do lote ${lote}...`);
  let voltados = 0;
  for (let i = 0; i < linhas.length; i += 500) {
    for (const l of linhas.slice(i, i + 500)) {
      const r: any = await pool.query("UPDATE product SET category_id = ? WHERE id = ? AND category_id = ?", [
        l.valor_antes === null ? null : Number(l.valor_antes),
        Number(l.registro_id),
        Number(l.valor_depois),
      ]);
      voltados += Number(r.affectedRows ?? 0);
    }
    console.log(`  ${Math.min(i + 500, linhas.length).toLocaleString("pt-BR")}/${linhas.length.toLocaleString("pt-BR")}`);
  }
  console.log(`\n${voltados.toLocaleString("pt-BR")} produtos voltaram ao estado anterior.`);
  const intactos = linhas.length - voltados;
  if (intactos) console.log(`${intactos.toLocaleString("pt-BR")} já tinham sido mudados depois — foram preservados.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
