// CLASSIFICAR POR IA os produtos que a FONTE não classifica.
//
// ====================================================================
// O PROBLEMA, medido em 17/08/2026
// ====================================================================
// Depois de reler 16.116 páginas da fonte, sobraram **15.890 produtos à venda
// sem categoria** e a fonte não tem resposta para eles:
//
//     9.371  a página não declara categoria nenhuma
//     6.519  a página declara "Diversos" — a gaveta de bagunça DELA
//            (a própria trilha da fonte diz "Início › Categorias › Diversos")
//
// Não é falta de esforço nosso: a informação não existe do outro lado. Sobram
// dois caminhos — jogar os 15.890 numa categoria "Diversos" nossa, o que os
// esconde num depósito que ninguém navega, ou pedir a uma IA que leia o nome e
// escolha. Este arquivo é o segundo.
//
// ====================================================================
// ⚠ POR QUE ESTE NÃO É O CATEGORIZADOR QUE FALHOU EM 16/08
// ====================================================================
// Já houve uma tentativa de classificar em massa, e ela foi PARADA com razão:
// `categorize.ts` adivinhava pelo NOME com regras de palavra-chave e chamou
// **8 secadores de cabelo de "informatica"** (viu "HP11", "KS-4200" e pensou em
// computador). Acertou ~10 em 20. Três diferenças aqui:
//
//   1. Quem decide é um modelo de linguagem, não uma tabela de palavras — ele
//      sabe que "Secador Philco Ceramic" é secador e não computador.
//   2. **A IA pode dizer "nao-sei"**, e o produto então fica sem categoria.
//      Categoria errada engana MAIS que categoria nenhuma: quem filtra
//      "informática" e encontra secador perde a confiança no filtro inteiro.
//   3. **Marca o que tocou** em `alteracao_massa`, ANTES de tocar. Em 16/08 o
//      categorizador escreveu por cima sem rastro e só deu para recuperar 192
//      de 500 produtos — os outros 308 ficaram errados sem volta. Aqui,
//      desfazer é um comando.
//
// ====================================================================
// O PROTOCOLO — não pular etapas
// ====================================================================
//   1º  --amostra=200   → classifica 200 sorteados e grava (é desfazível)
//   2º  CONFERIR 20 À MÃO. Critério combinado: 18 acertos em 20.
//   3º  Só então o resto. Se reprovar, `--desfazer=<lote>` e o assunto morre.
//
//   npm run categorizar-ia -w @icompras/worker -- --amostra=200
//   npm run categorizar-ia -w @icompras/worker -- --simular --amostra=40
//   npm run categorizar-ia -w @icompras/worker
//   npm run categorizar-ia -w @icompras/worker -- --desfazer=<lote>
import "../env.js";
import { pool } from "@icompras/db";
import { decifrarSegredo } from "@icompras/core";

const PROCESSO = "categorizar-ia";
const API = "https://api.deepseek.com/chat/completions";

// Produtos por chamada. 40 é o meio do caminho: menos que isso multiplica o
// custo (a lista de categorias vai em TODA chamada), e muito mais que isso
// piora a atenção do modelo item a item — ele começa a repetir a resposta do
// vizinho.
const POR_CHAMADA = 40;

// PAUSA ENTRE CHAMADAS.
//
// 💡 Este processo é leve para o NOSSO servidor de propósito: quem pensa é o
// provedor, e aqui só sobra gravar ~40 linhas por vez. Mas leve não é nulo, e a
// regra desta casa é não somar carga sem necessidade — em 12/08/2026 o site
// afogou por trabalho de fundo que ninguém estava cronometrando. Um segundo de
// respiro entre lotes não muda em nada o tempo total (a chamada em si leva
// vários segundos) e mantém o processo abaixo do ruído.
const PAUSA_MS = Number(process.env.IA_PAUSA_MS ?? 1000);

// Preço de tabela do deepseek-chat em 17/08/2026, em dólares por MILHÃO de
// tokens. ⚠ Serve para dar ordem de grandeza no relatório, NÃO para fechar
// conta: o valor real é o que aparece em platform.deepseek.com/usage, e o
// desconto de cache não está previsto aqui (a lista de categorias vai no
// começo do pedido justamente para ser cacheada, então o gasto de verdade
// tende a ser MENOR que o estimado).
const USD_POR_M_ENTRADA = 0.27;
const USD_POR_M_SAIDA = 1.1;

const simular = process.argv.includes("--simular");
const amostra = Number(process.argv.find((a) => a.startsWith("--amostra="))?.split("=")[1] ?? 0);
const limite = Number(process.argv.find((a) => a.startsWith("--limite="))?.split("=")[1] ?? 0);
const desfazer = process.argv.find((a) => a.startsWith("--desfazer="))?.split("=")[1];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Candidato {
  id: number;
  nome: string;
  marca: string | null;
  specs: string | null;
}

/**
 * A LINHA QUE O MODELO LÊ.
 *
 * 💡 A ficha técnica entra porque o nome sozinho às vezes não diz nada:
 * "Novastar TB60" pode ser qualquer coisa, e a ficha da fonte informa que é
 * equipamento de vídeo. São ~30 tokens a mais por produto que evitam um
 * "nao-sei" — ou, pior, um palpite.
 */
function linhaDoProduto(c: Candidato, i: number): string {
  const partes = [c.nome.slice(0, 110)];
  if (c.marca) partes.push(`marca: ${c.marca}`);
  if (c.specs) {
    try {
      const fichas: Array<{ k: string; v: string }> = JSON.parse(c.specs);
      const uteis = fichas
        .filter((f) => f?.k && f?.v && !/^(marca|modelo|garantia|c[oó]digo)$/i.test(f.k))
        .slice(0, 3)
        .map((f) => `${f.k}=${String(f.v).slice(0, 40)}`);
      if (uteis.length) partes.push(uteis.join("; "));
    } catch {
      /* ficha malformada não invalida o produto */
    }
  }
  return `${i}. ${partes.join(" | ")}`;
}

/**
 * A LISTA QUE O MODELO LÊ — cada código COM A FAMÍLIA a que pertence.
 *
 * ⚠ Sem a família, três dos 25 primeiros palpites saíram errados pelo mesmo
 * motivo (medido em 17/08/2026, na simulação): o modelo não tinha como saber
 * que `processador` aqui é peça de computador (e mandou para lá um processador
 * de áudio automotivo), nem que `acessorios-para-videogame` não abriga uma
 * escova de toca-discos. Dizer "processador (informatica)" resolve a
 * ambiguidade na origem, custa ~2 palavras por código e, como a lista vai na
 * primeira mensagem, o provedor a reaproveita entre as chamadas.
 */
function comFamilia(cats: Array<{ slug: string; grupo: string | null }>): string[] {
  return cats
    .map((c) => (c.grupo ? `${c.slug} (${c.grupo})` : c.slug))
    .sort();
}

function instrucoes(slugs: string[], familias: string[]): string {
  return [
    "Você classifica produtos de um comparador de preços do Paraguai.",
    "Escolhe UMA categoria para cada produto, obrigatoriamente da lista abaixo.",
    "",
    "REGRAS:",
    "1. A maioria dos produtos TEM uma categoria certa nesta lista. Procure-a: o",
    "   trabalho é classificar, e devolver tudo como desconhecido não ajuda ninguém.",
    '2. Use "nao-sei" quando NENHUM código da lista servir para aquele produto, ou',
    "   quando o nome for genérico demais para dizer o que a coisa é. Não use por",
    "   hesitar entre dois códigos parecidos — nesse caso escolha o mais específico",
    "   dos dois. Só não empurre para uma categoria de outra família: é ela que o",
    "   cliente filtra, e achar ali coisa que não pertence queima o filtro inteiro.",
    "3. Cada código vem com a FAMÍLIA entre parênteses, para desfazer ambiguidade:",
    "   `processador (informatica)` é peça de computador e não serve para um",
    "   processador de áudio automotivo. Responda só o código, sem os parênteses.",
    "4. Classifique o que o produto É, não o aparelho com que ele é usado. Capa de",
    "   celular é capa, não celular. Bolsa de câmera é bolsa, não câmera. Capa de",
    "   mala de viagem é acessório de viagem, não capa de notebook.",
    "5. Nunca invente um código que não esteja na lista. Fora da lista = nao-sei.",
    "6. Responda SÓ o JSON pedido, sem texto antes ou depois.",
    "",
    'DIGA TAMBÉM O QUANTO ESTÁ SEGURO, no campo "k":',
    '  "alta"  = você sabe o que o produto é E existe um código que o descreve.',
    '  "media" = o código é o mais próximo que achou, mas não descreve bem o',
    "            produto (ex.: um suporte de antena posto em suporte-de-celular",
    "            por falta de coisa melhor). É melhor admitir isto do que fingir",
    "            certeza: o que estiver em «media» será revisto por gente.",
    "",
    "FORMATO DA RESPOSTA (uma entrada por produto recebido):",
    '[{"i":1,"c":"secador-de-cabelo","k":"alta"},{"i":2,"c":"nao-sei","k":"alta"}]',
    "",
    "",
    "SE NENHUM CÓDIGO ESPECÍFICO SERVIR, responda com o nome da FAMÍLIA. Vale",
    "como resposta e é melhor que nao-sei: uma luva de trabalho que não tem",
    'código próprio cabe em "casa-construcao". Famílias aceitas:',
    `  ${familias.join(", ")}`,
    "",
    `CÓDIGOS PERMITIDOS (${slugs.length}) — código (família):`,
    slugs.join("\n"),
  ].join("\n");
}

interface Escolha {
  i: number;
  c: string;
  /** Segurança declarada pelo próprio modelo: "alta" ou "media". */
  k: string;
}

// ACEITAR SÓ O QUE ELE DIZ SABER.
//
// ⚠ Medido em 17/08/2026, em três simulações de 40 produtos. Aceitando tudo, a
// conferência à mão dava ~88% de acerto — e os erros eram sempre do mesmo tipo:
// produto para o qual NÃO EXISTE categoria boa aqui, empurrado para a mais
// parecida (gel lubrificante em "doces", suporte de antena Starlink em
// "suporte-para-celular", pincel escolar em "pincel-para-maquiagem"). Pedindo
// ao modelo que declare quando está só chutando o mais próximo, esses casos se
// separam sozinhos — e vão para o "Diversos", que é o lugar certo deles.
const ACEITAR_MEDIA = process.argv.includes("--aceitar-media");

/**
 * Lê a resposta do modelo.
 *
 * Tolerante de propósito: se ele embrulhar o JSON em ```json, mandar texto
 * antes ou devolver um objeto no lugar do vetor, o lote todo não pode se
 * perder por causa de formatação. O que NÃO é tolerado é código inválido — isso
 * é conferido depois, contra as nossas categorias.
 */
function lerEscolhas(texto: string): Escolha[] {
  const inicio = texto.indexOf("[");
  const fim = texto.lastIndexOf("]");
  if (inicio < 0 || fim <= inicio) return [];
  try {
    const bruto = JSON.parse(texto.slice(inicio, fim + 1));
    if (!Array.isArray(bruto)) return [];
    return bruto
      .map((x: any) => ({
        i: Number(x?.i),
        // A lista mostra "codigo (familia)"; se ele devolver a família junto,
        // é obediência ao formato que ele viu, não código inválido — corta.
        c: String(x?.c ?? "").trim().toLowerCase().split(" (")[0].trim(),
        // Sem "k" declarado, trata como "media": quem não disse que sabe, não
        // disse que sabe. O silêncio não pode valer como certeza.
        k: String(x?.k ?? "media").trim().toLowerCase(),
      }))
      .filter((x) => Number.isFinite(x.i) && x.c);
  } catch {
    return [];
  }
}

interface Gasto {
  entrada: number;
  saida: number;
  cache: number;
}

/** Chama o modelo. Devolve null quando não deu (e o lote é apenas saltado). */
async function classificarLote(
  chave: string,
  modelo: string,
  sistema: string,
  candidatos: Candidato[],
  gasto: Gasto,
): Promise<Escolha[] | null> {
  const corpo = {
    model: modelo,
    // temperatura 0: a mesma lista tem de dar a mesma resposta. Criatividade
    // aqui é defeito, não recurso.
    temperature: 0,
    messages: [
      // ⚠ A LISTA DE CATEGORIAS VAI NA PRIMEIRA MENSAGEM, e ela é idêntica em
      // todas as chamadas. É o que permite ao provedor reaproveitar o trecho
      // (cache de contexto) e cobrar bem menos por ele. Se a lista fosse junto
      // dos produtos, cada chamada pagaria os ~2.600 tokens dela cheios.
      { role: "system", content: sistema },
      { role: "user", content: candidatos.map((c, n) => linhaDoProduto(c, n + 1)).join("\n") },
    ],
  };

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.status === 429 || res.status >= 500) {
        // Ocupado ou instável do lado deles: espera crescente e tenta de novo.
        await sleep(3000 * (tentativa + 1));
        continue;
      }
      if (!res.ok) {
        console.log(`  ⚠ o provedor recusou (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
        return null;
      }
      const dados: any = await res.json();
      const uso = dados?.usage ?? {};
      gasto.entrada += Number(uso.prompt_tokens ?? 0);
      gasto.saida += Number(uso.completion_tokens ?? 0);
      gasto.cache += Number(uso.prompt_cache_hit_tokens ?? 0);
      const texto = String(dados?.choices?.[0]?.message?.content ?? "");
      const escolhas = lerEscolhas(texto);
      if (!escolhas.length) {
        // Mostrar o começo da resposta é a diferença entre "deu errado" e
        // "deu errado por isto". Sem esta linha, o lote perdido vira mistério.
        const motivo = dados?.choices?.[0]?.finish_reason ?? "?";
        console.log(`  ⚠ resposta ilegível (fim: ${motivo}): ${texto.slice(0, 160).replace(/\s+/g, " ")}`);
      }
      return escolhas;
    } catch (e: any) {
      await sleep(3000 * (tentativa + 1));
      if (tentativa === 2) console.log(`  ⚠ falhou ao chamar o provedor: ${String(e?.message ?? e).slice(0, 150)}`);
    }
  }
  return null;
}

/** Anota a chamada no contador do Admin › IA — inclusive quando falha. */
async function anotarChamada(provider: string, ok: boolean, detalhe?: string): Promise<void> {
  await pool
    .query(
      `INSERT INTO ia_uso (day, servico, provider, chamadas, falhas, detalhe)
       VALUES (CURDATE(), 'texto', ?, 1, ?, ?)
       ON DUPLICATE KEY UPDATE chamadas = chamadas + 1,
                               falhas = falhas + VALUES(falhas),
                               detalhe = IF(VALUES(falhas) = 1, VALUES(detalhe), detalhe)`,
      [provider, ok ? 0 : 1, detalhe?.slice(0, 255) ?? null],
    )
    .catch(() => {});
}

function marcaDeLote(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function main(): Promise<void> {
  if (desfazer) return void (await desfazerLote(desfazer));

  // ------------------------------------------------------------------
  // A CONFIGURAÇÃO É A DO PAINEL, não do código.
  //
  // ⚠ O teto do mês vale para este processo também. Foi decidido em 11/08/2026
  // que serviço pago sem teto e sem contador é prejuízo que só aparece na
  // fatura — e um processo em massa é justamente o que estoura uma conta.
  // ------------------------------------------------------------------
  const [cfg]: any[] = await pool.query("SELECT * FROM ia_config WHERE id = 1");
  if (!cfg) return void console.log("Não há configuração de IA (Admin › Inteligência artificial).");
  if (!Number(cfg.texto_ativo)) return void console.log("A geração de texto está DESLIGADA em Admin › IA.");
  const chave = decifrarSegredo(cfg.texto_key);
  if (!chave) {
    return void console.log(
      "Sem chave utilizável do DeepSeek. Cadastrar em Admin › IA.\n" +
        "(se a chave está lá, o AUTH_SECRET mudou e todas as chaves ficaram ilegíveis)",
    );
  }
  const provider = String(cfg.texto_provider ?? "deepseek");
  const modelo = String(cfg.texto_model ?? "deepseek-chat");
  const tetoMes = Number(cfg.texto_limite_mes ?? 0);

  const [usoMes]: any[] = await pool.query(
    `SELECT COALESCE(SUM(chamadas),0) n FROM ia_uso
      WHERE servico='texto' AND day >= DATE_FORMAT(CURDATE(),'%Y-%m-01')`,
  );
  let chamadasDoMes = Number(usoMes?.n ?? 0);
  if (tetoMes > 0 && chamadasDoMes >= tetoMes) {
    return void console.log(`Teto do mês já atingido (${chamadasDoMes}/${tetoMes}). Ajustável em Admin › IA.`);
  }

  const cats: Array<{ id: number; slug: string; grupo: string | null }> = await pool.query(
    "SELECT c.id, c.slug, p.slug AS grupo FROM category c LEFT JOIN category p ON p.id = c.parent_id",
  );
  // Só folhas: sugerir um GRUPO ("eletronicos") é quase não classificar, e a
  // navegação por grupo já vem dos filhos.
  const filhos: Array<{ id: number }> = await pool.query("SELECT DISTINCT parent_id id FROM category WHERE parent_id IS NOT NULL");
  const grupos = new Set(filhos.map((f) => Number(f.id)));
  const folhas = cats.filter((c) => !grupos.has(Number(c.id)));
  const idPorSlug = new Map(folhas.map((c) => [c.slug, Number(c.id)]));
  // As famílias, aceitas como resposta de último recurso — ver o trecho que as
  // recebe, mais abaixo.
  const idPorGrupoSlug = new Map(cats.filter((c) => grupos.has(Number(c.id))).map((c) => [c.slug, Number(c.id)]));
  const sistema = instrucoes(comFamilia(folhas), [...idPorGrupoSlug.keys()].sort());
  console.log(
    `${idPorSlug.size} categorias oferecidas ao modelo (com a família de cada uma)` +
      ` + ${idPorGrupoSlug.size} famílias, para quando nenhuma servir.`,
  );
  console.log(`Modelo: ${provider}/${modelo} · teto do mês: ${chamadasDoMes}/${tetoMes || "sem teto"}`);

  const lote = marcaDeLote();
  console.log(amostra ? `⚠ AMOSTRA de ${amostra} produtos sorteados. Lote ${lote}.` : `Lote ${lote}.`);
  if (simular) console.log("⚠ SIMULAÇÃO — nada será gravado.");

  // ------------------------------------------------------------------
  // QUEM ENTRA.
  //
  // Só produto que (a) está sem categoria, (b) JÁ FOI CONFERIDO na fonte —
  // existe linha em `produto_categoria_fonte`, ou seja, sabemos que a fonte não
  // tem resposta — e (c) continua à venda. Gastar IA com produto que saiu do ar
  // é pagar para arrumar prateleira vazia.
  // ------------------------------------------------------------------
  const condicoes = `p.category_id IS NULL
      AND EXISTS (SELECT 1 FROM product_variant v JOIN offer o ON o.variant_id = v.id
                   WHERE v.product_id = p.id AND o.gone_at IS NULL)`;

  let posicao = 0;
  if (!amostra) {
    const est: any[] = await pool.query("SELECT posicao FROM processo_estado WHERE nome = ?", [PROCESSO]);
    posicao = est.length ? Number(est[0].posicao) : 0;
    if (posicao) console.log(`Continuando do produto ${posicao}.`);
  }

  const gasto: Gasto = { entrada: 0, saida: 0, cache: 0 };
  const resultados: Array<{ nome: string; slug: string }> = [];
  const recusados: Array<{ nome: string; slug: string }> = [];
  let vistos = 0;
  let classificados = 0;
  let naoSei = 0;
  let invalidos = 0;
  let semResposta = 0;
  let semCerteza = 0;
  let emFamilia = 0;
  const inventados = new Map<string, number>();

  while (true) {
    // Em amostra, sorteia UMA vez e sai; no modo normal, caminha pelo id.
    const candidatos: Candidato[] = amostra
      ? await pool.query(
          `SELECT p.id, p.canonical_name AS nome, p.brand AS marca, p.specs
             FROM product p JOIN produto_categoria_fonte f ON f.product_id = p.id
            WHERE ${condicoes}
            ORDER BY RAND() LIMIT ?`,
          [amostra],
        )
      : await pool.query(
          `SELECT p.id, p.canonical_name AS nome, p.brand AS marca, p.specs
             FROM product p JOIN produto_categoria_fonte f ON f.product_id = p.id
            WHERE ${condicoes} AND p.id > ?
            ORDER BY p.id LIMIT 500`,
          [posicao],
        );
    if (!candidatos.length) break;
    if (!amostra) posicao = Number(candidatos[candidatos.length - 1].id);

    for (let i = 0; i < candidatos.length; i += POR_CHAMADA) {
      if (tetoMes > 0 && chamadasDoMes >= tetoMes) {
        console.log(`\n⚠ Teto do mês atingido (${chamadasDoMes}/${tetoMes}) — parando aqui.`);
        break;
      }
      const fatia = candidatos.slice(i, i + POR_CHAMADA);
      const escolhas = await classificarLote(chave, modelo, sistema, fatia, gasto);
      chamadasDoMes++;
      if (!simular) await anotarChamada(provider, escolhas !== null, escolhas === null ? "sem resposta" : undefined);
      vistos += fatia.length;

      // ⚠ VETOR VAZIO É FALHA, NÃO "nenhuma categoria". Este `if` já existiu só
      // como `if (!escolhas)`, e `[]` é verdadeiro em JavaScript: quando a
      // resposta vinha malformada, o lote inteiro sumia **sem entrar em conta
      // nenhuma**. No primeiro teste de verdade, 200 produtos entraram, 47
      // foram gravados e o relatório não acusou nada — o número só apareceu
      // porque fui contar as linhas no banco. Contador que não fecha é pior
      // que contador que não existe: ele dá confiança falsa.
      if (!escolhas || !escolhas.length) {
        semResposta += fatia.length;
        console.log(`  ⚠ lote de ${fatia.length} sem resposta aproveitável`);
        continue;
      }

      // Casa a resposta com o produto pelo número da linha e CONFERE o código.
      //
      // ⚠ O modelo pode responder por MENOS produtos do que recebeu (resposta
      // cortada no meio). Quem ficou sem resposta tem de aparecer na conta, e
      // não evaporar: `respondidos` existe só para isso.
      const respondidos = new Set<number>();
      const aceitos: Array<{ id: number; nome: string; slug: string; catId: number }> = [];
      for (const e of escolhas) {
        const c = fatia[e.i - 1];
        if (!c) continue;
        respondidos.add(e.i);
        if (e.c === "nao-sei" || e.c === "naosei") {
          naoSei++;
          continue;
        }
        const idFolha = idPorSlug.get(e.c);
        const idGrupo = idPorGrupoSlug.get(e.c);

        if (idFolha !== undefined) {
          if (e.k !== "alta" && !ACEITAR_MEDIA) {
            // Ele achou "o mais parecido", não "o certo". Fica sem categoria e
            // cai na rede do "Diversos" — que é exatamente para isto.
            semCerteza++;
            // Guardar alguns para olhar: é a única forma de saber se a recusa
            // está protegendo o catálogo ou jogando fora trabalho bom.
            if (recusados.length < 25) recusados.push({ nome: c.nome, slug: e.c });
            continue;
          }
          aceitos.push({ id: c.id, nome: c.nome, slug: e.c, catId: idFolha });
          continue;
        }

        if (idGrupo !== undefined) {
          // ⚠ A FAMÍLIA VALE, e descobri isso olhando o que ele recusava
          // (17/08/2026). Para luvas, sapateira e absorvente a nossa árvore não
          // tem folha nenhuma — ela veio da fonte e a fonte também não tem. Ele
          // então oferecia a família ("casa-construcao") e eu descartava.
          //
          // Família é MUITO melhor que "Diversos": "Casa & Construção" é uma
          // página que a pessoa navega de verdade; "Diversos" é um depósito.
          // Aqui não se exige certeza "alta": dizer a família já é a resposta
          // prudente de quem não achou a prateleira exata.
          aceitos.push({ id: c.id, nome: c.nome, slug: e.c, catId: idGrupo });
          emFamilia++;
          continue;
        }

        // Código inventado. Vale contar E GUARDAR QUAL: se este número subir,
        // o problema está na lista ou nas instruções, não no produto — e o
        // nome inventado costuma dizer exatamente o que está faltando.
        invalidos++;
        inventados.set(e.c, (inventados.get(e.c) ?? 0) + 1);
      }
      const mudos = fatia.length - respondidos.size;
      if (mudos > 0) {
        semResposta += mudos;
        console.log(`  ⚠ ${mudos} produto(s) do lote ficaram sem resposta (resposta curta demais)`);
      }

      if (!simular && aceitos.length) {
        // ⚠ A MARCA VEM ANTES DA MUDANÇA. Se o processo morrer entre as duas,
        // sobra uma marca a mais (inofensiva) em vez de uma mudança sem marca
        // (irreversível) — o erro que deixou 308 produtos sem volta em 16/08.
        await pool.query(
          `INSERT INTO alteracao_massa
             (processo, lote, tabela, registro_id, campo, valor_antes, valor_depois, origem)
           VALUES ${aceitos.map(() => "(?,?,'product',?,'category_id',NULL,?,?)").join(",")}`,
          aceitos.flatMap((a) => [PROCESSO, lote, a.id, String(a.catId), `ia:${modelo}:${a.slug}`]),
        );
        const porCat = new Map<number, number[]>();
        for (const a of aceitos) {
          const atual = porCat.get(a.catId);
          if (atual) atual.push(a.id);
          else porCat.set(a.catId, [a.id]);
        }
        for (const [catId, ids] of porCat) {
          // `AND category_id IS NULL` protege contra corrida: se o coletor
          // classificou o produto enquanto a IA pensava, o dele vale.
          await pool.query(
            `UPDATE product SET category_id = ? WHERE id IN (${ids.map(() => "?").join(",")}) AND category_id IS NULL`,
            [catId, ...ids],
          );
        }
      }

      classificados += aceitos.length;
      for (const a of aceitos) if (resultados.length < 40) resultados.push({ nome: a.nome, slug: a.slug });
      console.log(
        `  ${vistos} vistos · ${classificados} classificados · ${naoSei} "não sei"` +
          `${semCerteza ? ` · ${semCerteza} sem certeza` : ""}` +
          `${invalidos ? ` · ${invalidos} código inválido` : ""}${semResposta ? ` · ${semResposta} sem resposta` : ""}`,
      );
      await sleep(PAUSA_MS);
    }

    if (!amostra && !simular) {
      await pool.query(
        `INSERT INTO processo_estado (nome, posicao, feitos, alterados, falhas, lote)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE posicao=VALUES(posicao), feitos=VALUES(feitos),
           alterados=VALUES(alterados), falhas=VALUES(falhas), lote=VALUES(lote)`,
        [PROCESSO, posicao, vistos, classificados, semResposta, lote],
      );
    }

    if (amostra) break;
    if (limite && vistos >= limite) {
      console.log(`\nLimite de ${limite} atingido — parando.`);
      break;
    }
    if (tetoMes > 0 && chamadasDoMes >= tetoMes) break;
  }

  const custo = (gasto.entrada / 1e6) * USD_POR_M_ENTRADA + (gasto.saida / 1e6) * USD_POR_M_SAIDA;
  console.log(`\n${"=".repeat(58)}`);
  console.log(`Produtos vistos:   ${vistos.toLocaleString("pt-BR")}`);
  console.log(`Classificados:     ${classificados.toLocaleString("pt-BR")}`);
  if (emFamilia) console.log(`  destes, na família: ${emFamilia.toLocaleString("pt-BR")}  (sem código específico na nossa árvore)`);
  console.log(`Respondeu "não sei": ${naoSei.toLocaleString("pt-BR")}`);
  if (semCerteza) console.log(`Achou só o parecido:  ${semCerteza.toLocaleString("pt-BR")}  (recusado de propósito; vai para o Diversos)`);
  if (invalidos) {
    console.log(`Código inválido:   ${invalidos.toLocaleString("pt-BR")}  (⚠ se for muito, revisar as instruções)`);
    // A lista dos inventados é a pauta: código que ele pede muito e não existe
    // costuma ser categoria que a nossa árvore realmente não tem.
    for (const [nome, n] of [...inventados].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`     ${String(n).padStart(4)}× pediu "${nome}"`);
    }
  }
  if (semResposta) console.log(`Sem resposta:      ${semResposta.toLocaleString("pt-BR")}`);
  console.log(
    `Tokens: ${gasto.entrada.toLocaleString("pt-BR")} de entrada` +
      `${gasto.cache ? ` (${gasto.cache.toLocaleString("pt-BR")} reaproveitados do cache)` : ""}` +
      ` · ${gasto.saida.toLocaleString("pt-BR")} de saída`,
  );
  console.log(`Custo estimado:    US$ ${custo.toFixed(4)}  (teto de tabela; o real está no painel do DeepSeek)`);
  if (!simular) console.log(`\nPara desfazer tudo desta rodada:  -- --desfazer=${lote}`);

  if (recusados.length) {
    console.log("\nAmostra do que ele RECUSOU por falta de certeza (não foi gravado):");
    for (const r of recusados.slice(0, 20)) {
      console.log(`  ${r.nome.slice(0, 62).padEnd(63)} → diria ${r.slug}`);
    }
  }

  if (resultados.length) {
    console.log("\nAmostra do que ele decidiu — CONFERIR À MÃO (critério: 18 certos em 20):");
    for (const r of resultados.slice(0, 25)) {
      console.log(`  ${r.nome.slice(0, 62).padEnd(63)} → ${r.slug}`);
    }
  }
  await pool.end();
}

/**
 * DESFAZER uma rodada inteira. Igual ao da recuperação pela fonte: só volta o
 * que AINDA está como este processo deixou, para não atropelar quem mudou
 * depois.
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
  for (const l of linhas) {
    const r: any = await pool.query("UPDATE product SET category_id = ? WHERE id = ? AND category_id = ?", [
      l.valor_antes === null ? null : Number(l.valor_antes),
      Number(l.registro_id),
      Number(l.valor_depois),
    ]);
    voltados += Number(r.affectedRows ?? 0);
  }
  console.log(`\n${voltados.toLocaleString("pt-BR")} produtos voltaram a ficar sem categoria.`);
  const intactos = linhas.length - voltados;
  if (intactos) console.log(`${intactos.toLocaleString("pt-BR")} já tinham sido mudados depois — foram preservados.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
