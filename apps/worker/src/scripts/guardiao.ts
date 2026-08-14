// Guardião — vigia o robô coletor e o site, e religa o que travar.
//
// Motivo: o coletor já ficou horas "rodando" sem produzir nada porque o
// navegador interno morria e o processo caía; ninguém percebeu por dias.
// Este processo confere a cada poucos minutos e age sozinho em casos simples
// e reversíveis (religar um serviço). Nunca mexe em código nem em dados.
//
//   npm run guardiao -w @icompras/worker
//   npm run guardiao -w @icompras/worker -- --uma-vez   (uma verificação só)
import "../env.js";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "@icompras/db";
// ⚠ `fetch` E `ProxyAgent` do MESMO pacote. O Node 24 traz um undici próprio
// embutido no `fetch` global; misturar o ProxyAgent do undici instalado com o
// fetch global estoura "invalid onRequestStart method" e TODA requisição pelo
// proxy falha. Em 08/08/2026 isso enganou o coletor por horas: ele concluía
// "Dallas caiu" e voltava a sair pelo IP da VPS, calado.
import { fetch as buscarNaWeb, ProxyAgent } from "undici";
import { coletarMetrica, conferirLimites } from "../metricas.js";

const execAsync = promisify(exec);
// .../apps/worker/src/scripts/guardiao.ts → raiz do projeto
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

// Lê número do ambiente sem aceitar lixo.
//
// `Number(process.env.X ?? 300)` parece seguro mas não é: se a variável
// existir vazia, Number("") dá 0 — e um limite de "0 segundos sem sinal"
// faz o guardião religar o coletor a cada verificação. Já apareceu no
// histórico um religamento com o motivo "sem sinal de vida há 2s", que é
// exatamente essa cara. Aqui, valor inválido cai no padrão.
function num(valor: string | undefined, padrao: number): number {
  const n = Number(valor);
  return valor != null && valor !== "" && isFinite(n) && n > 0 ? n : padrao;
}

const INTERVALO_MIN = num(process.env.GUARD_INTERVAL_MIN, 5);
// Sem sinal de vida por este tempo = travado. O coletor bate o ponto a cada
// produto e a cada 5s enquanto espera, então alguns minutos já é folga larga.
const SEM_SINAL_SEG = num(process.env.GUARD_STALE_SEC, 300);
const MAX_RELIGADAS_HORA = num(process.env.GUARD_MAX_RESTARTS, 3);
const SITE_URL = process.env.GUARD_SITE_URL ?? "http://127.0.0.1:3000/es";

// Quem responde "qual é o meu IP". Serviço de texto puro, resposta minúscula.
const ONDE_PERGUNTO_MEU_IP = process.env.GUARD_IP_ECHO ?? "https://api.ipify.org";
// QUANTO ESPERAR — número MEDIDO, não chutado.
//
// Primeiro pus 20s e nunca funcionou: gravava sempre "IP não medido". Medindo
// 8 chamadas seguidas pelo proxy em 08/08/2026, o padrão apareceu: as três
// primeiras levaram 13,2s / 14,5s / 9,7s e as cinco seguintes 1,6s. É o custo
// de abrir caminho pelo túnel (a mais lenta que vi foi 28,7s). Como o guardião
// faz UMA chamada a cada 5 minutos, a dele é sempre a chamada fria — a cara é
// a que conta. 45s deixa folga sobre o pior caso e cabe de sobra no intervalo.
const ESPERA_DO_IP_MS = num(process.env.GUARD_IP_TIMEOUT_MS, 45_000);
// Reaproveitado entre as verificações: abrir um por vez vaza conexão.
let despachante: ProxyAgent | undefined;

// Desde a v1.1 o coletor são QUATRO processos (icompras-crawler-0..3), não um.
// O `/` do pm2 é busca por padrão, então isto religa os quatro de uma vez.
//
// Religar todos e não só o que travou é de propósito: eles dividem uma fila e
// um teto de pedidos; subir um sozinho, sem saber em que estado os outros
// estão, é mais arriscado do que reiniciar a turma inteira, que leva segundos.
const NOME_DOS_COLETORES = process.env.GUARD_CRAWLER_APP ?? "/icompras-crawler-/";
const UMA_VEZ = process.argv.includes("--uma-vez");

// Auditoria semanal de cobertura do catálogo (ver auditoria.ts).
// ATENÇÃO AO FUSO: a VPS roda em UTC e o Paraguai/Brasil é UTC-3, então
// 6h UTC = 3h da madrugada aqui. Domingo às 6h UTC ainda é domingo local,
// não vira o dia. Se um dia a VPS mudar de fuso, ajustar GUARD_AUDIT_HOUR.
// Aqui o zero é válido (domingo / meia-noite), então não dá para usar num().
function numZeroOk(valor: string | undefined, padrao: number, max: number): number {
  const n = Number(valor);
  return valor != null && valor !== "" && Number.isInteger(n) && n >= 0 && n <= max ? n : padrao;
}
const AUDIT_DIA = numZeroOk(process.env.GUARD_AUDIT_DAY, 0, 6); // 0 = domingo
const AUDIT_HORA = numZeroOk(process.env.GUARD_AUDIT_HOUR, 6, 23);

// Transação que bloqueia alguém há mais tempo que isto = encerrar.
//
// 5 minutos é folgado: tudo que roda longo aqui (classificação, resumo
// diário) foi cortado em pedaços de segundos em 07/08/2026. Transação
// bloqueadora passando de 5 min é defeito, não trabalho.
const TRAVA_SEG = num(process.env.GUARD_LOCK_SEC, 300);

// Quantos reinícios NUM ÚNICO INTERVALO já contam como laço.
// O intervalo padrão é 5 min; um app saudável reinicia zero vez nesse tempo.
const REINICIOS_LACO = num(process.env.GUARD_RESTART_LOOP, 5);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function registrar(target: string, status: string, detail: string, action: string): Promise<void> {
  await pool.query("INSERT INTO watchdog_log (target, status, detail, action) VALUES (?, ?, ?, ?)", [
    target,
    status,
    detail.slice(0, 500),
    action,
  ]);
  console.log(`[${new Date().toISOString()}] ${target}: ${status} — ${detail} (${action})`);
}

async function religadasNaUltimaHora(target: string): Promise<number> {
  const [r] = await pool.query(
    "SELECT COUNT(*) n FROM watchdog_log WHERE target = ? AND action = 'reiniciado' AND happened_at > NOW() - INTERVAL 1 HOUR",
    [target],
  );
  return Number(r.n);
}

// Religa um app do PM2. É a única ação que o guardião toma, e ela é reversível.
async function religar(app: string, target: string, motivo: string): Promise<string> {
  if ((await religadasNaUltimaHora(target)) >= MAX_RELIGADAS_HORA) {
    await registrar(target, "reiniciando-demais", `${motivo} — já religado ${MAX_RELIGADAS_HORA}x na última hora, parei de tentar`, "limite-atingido");
    return "limite-atingido";
  }
  try {
    await execAsync(`pm2 restart ${app}`, { timeout: 60000 });
    await registrar(target, "religado", motivo, "reiniciado");
    return "reiniciado";
  } catch (e) {
    await registrar(target, "falha-ao-religar", `${motivo} — ${(e as Error).message}`, "nenhuma");
    return "falhou";
  }
}

// ---------------------------------------------------------------------------
// Verificações

// O BANCO TRAVADO — a verificação que faltava, e que teria evitado 3h52 de
// coleta parada em 07/08/2026.
//
// O QUE ACONTECEU: o `UPDATE` da classificação de prioridade ficou 3h52 rodando
// com **1.091.353 linhas travadas**. Os robôs não conseguiam nem gravar produto
// novo. O guardião VIU o sintoma ("robô sem sinal") e aplicou o único remédio
// que tinha: reiniciar o robô. Mas o robô não estava doente — estava ESPERANDO.
// Reiniciar quem espera não adianta; era preciso tirar o que bloqueia.
//
// A correção manual levou 15 segundos: um `KILL` na transação. É essa ação que
// esta função automatiza.
//
// ⚠ DUAS TRAVAS antes de encerrar qualquer coisa:
//   1. só transação que está BLOQUEANDO ALGUÉM (`innodb_lock_waits`).
//      Transação longa sozinha não atrapalha ninguém e fica em paz — pode ser
//      uma migration ou uma manutenção legítima.
//   2. só depois de TRAVA_SEG. Disputa curta é normal e se resolve sozinha.
//
// É seguro desfazer: tudo que roda longo aqui é refeito na volta seguinte.
// Encerrar não perde dado, só adia.
async function conferirBanco(): Promise<{ status: string; detail: string }> {
  // ⚠ PELA LINHA DE COMANDO, e não pelo pool da aplicação.
  //
  // Descoberto testando (07/08/2026): o usuário do site (`icompras_app`) tem
  // permissão só no banco `icompras`. Sem o privilégio PROCESS ele **não
  // enxerga transação de outra conexão** — a consulta volta vazia —, e sem o
  // privilégio de administrar conexões também não conseguiria encerrar nada.
  // A primeira versão usava `pool.query` e por isso não achou nada, mesmo com
  // o travamento bem na frente. O teste é que mostrou.
  //
  // Dava para resolver dando os dois privilégios ao site. Preferi NÃO dar: o
  // site inteiro passaria a poder ler consultas alheias e derrubar conexões,
  // para sempre, por causa de uma tarefa do guardião. Aqui ele usa o cliente
  // de linha de comando, que entra pelo soquete local como root — o guardião
  // já roda como root e já chama o `pm2` do mesmo jeito.
  //
  // O filtro (quem bloqueia alguém, e há quanto tempo) fica no código e não no
  // SQL: mais fácil de ler e de testar que um HAVING por posição de coluna.
  const consulta =
    "SELECT t.trx_mysql_thread_id, TIMESTAMPDIFF(SECOND, t.trx_started, NOW()), " +
    "COALESCE(t.trx_rows_locked,0), " +
    "(SELECT COUNT(*) FROM information_schema.innodb_lock_waits w WHERE w.blocking_trx_id = t.trx_id), " +
    "COALESCE(LEFT(REPLACE(t.trx_query, CHAR(10), ' '),120),'(sem consulta)') " +
    "FROM information_schema.innodb_trx t ORDER BY 2 DESC";

  let saida: string[];
  try {
    // -N sem cabeçalho, -B separado por tabulação: fácil de partir.
    const { stdout } = await execAsync(`mariadb -N -B -e ${JSON.stringify(consulta)}`, { timeout: 20000 });
    saida = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch (e) {
    return { status: "ok", detail: `banco: não deu para conferir (${(e as Error).message.slice(0, 40)})` };
  }

  const bloqueadoras = saida
    .map((l) => l.split("\t"))
    .map((c) => ({
      conexao: Number(c[0]),
      seg: Number(c[1]),
      travadas: Number(c[2]),
      esperando: Number(c[3]),
      consulta: c[4] ?? "",
    }))
    // AS DUAS TRAVAS: só quem está bloqueando alguém, e só depois do tempo.
    .filter((t) => Number.isFinite(t.conexao) && t.esperando > 0 && t.seg > TRAVA_SEG);

  if (!bloqueadoras.length) return { status: "ok", detail: "banco sem travamento" };

  const encerradas: string[] = [];
  for (const t of bloqueadoras) {
    // A EVIDÊNCIA vai para o histórico ANTES da ação: se o encerramento falhar,
    // a informação do que estava travando não se perde.
    const evidencia =
      `conexão ${t.conexao} há ${Math.round(t.seg / 60)} min, ` +
      `${t.travadas.toLocaleString("pt-BR")} linha(s) travada(s), ` +
      `${t.esperando} esperando: ${t.consulta}`;
    try {
      await execAsync(`mariadb -e "KILL ${Number(t.conexao)}"`, { timeout: 15000 });
      await registrar("banco", "travado", evidencia, "transacao-encerrada");
      encerradas.push(`${t.conexao} (${Math.round(t.seg / 60)} min)`);
    } catch (e) {
      await registrar("banco", "travado", `${evidencia} — não consegui encerrar: ${(e as Error).message.slice(0, 60)}`, "nenhuma");
    }
  }

  return encerradas.length
    ? { status: "destravado", detail: `encerrei ${encerradas.length} transação(ões) que bloqueavam: ${encerradas.join(", ")}` }
    : { status: "travado", detail: `${bloqueadoras.length} bloqueando e não consegui encerrar` };
}

// A MEMÓRIA CURTA: compara a medição de agora com a da verificação anterior.
//
// ⚠ É a diferença entre "755 e caindo" e "755 e parado". O primeiro é trabalho
// acontecendo; o segundo é problema. Olhando só o valor, os dois são iguais —
// e foi assim que o guardião não viu nada de errado enquanto o dono via a fila
// se recuperando sozinha (07/08/2026).
//
// Devolve quantas verificações seguidas passaram SEM melhorar. Zero significa
// "melhorou agora" ou "é a primeira medição".
async function tendencia(chave: string, atual: number): Promise<number> {
  const linhas = await pool.query("SELECT valor, repeticoes FROM guardiao_tendencia WHERE chave = ?", [chave]);
  const anterior = linhas.length ? Number(linhas[0].valor) : null;
  // Melhorou (ou é a primeira vez): zera o contador.
  // Empate conta como NÃO melhorou — parado é exatamente o que se quer pegar.
  const semMelhora = anterior != null && atual >= anterior ? Number(linhas[0].repeticoes) + 1 : 0;
  await pool.query(
    `INSERT INTO guardiao_tendencia (chave, valor, repeticoes) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), repeticoes = VALUES(repeticoes),
       medido_em = CURRENT_TIMESTAMP`,
    [chave, atual, semMelhora],
  );
  return semMelhora;
}

// PRODUTOS QUENTES ATRASADOS — com tendência, não só com o número.
//
// É o alarme que o dono vê no painel, e o que mais deu alarme falso. A regra:
//   · nenhum atrasado          → tudo certo;
//   · atrasados MAS diminuindo → fila se recuperando, ficar quieto;
//   · atrasados e sem melhorar por várias verificações → aí sim avisar.
//
// Não religa nada de propósito. Fila parada pode ter dezenas de causas, e
// reiniciar o robô no meio de uma volta longa é o que mais atrapalha (foi o que
// criou o laço do guardião em 05/08). Aqui ele avisa e deixa para quem decide.
const CHECAGENS_SEM_MELHORA = num(process.env.GUARD_SEM_MELHORA, 3);

async function conferirAtrasados(): Promise<{ status: string; detail: string }> {
  let atrasados: number;
  try {
    // A MESMA conta do painel, inclusive o `EXISTS`: registro cujo produto não
    // tem mais oferta é fantasma que o robô nunca alcança, e contá-lo deixaria
    // o alarme ligado para sempre (ver o caso de 06/08 em icompras-projeto).
    const [r] = await pool.query(
      `SELECT COUNT(*) n
         FROM scrape_log s
        WHERE s.faixa = 'quente'
          AND s.last_crawled_at < NOW() - INTERVAL 6 HOUR
          AND EXISTS (SELECT 1 FROM offer o WHERE o.external_id = s.external_id)`,
    );
    atrasados = Number(r?.n ?? 0);
  } catch (e) {
    return { status: "ok", detail: `quentes: não deu para medir (${(e as Error).message.slice(0, 40)})` };
  }

  // ⚠ ZERO ZERA O CONTADOR, e isto não é detalhe.
  //
  // Peguei no teste: a versão anterior chamava `tendencia()` sempre. Com zero
  // atrasados, `0 >= 0` conta como "não melhorou" e o contador subia a cada
  // verificação, para sempre, com tudo em ordem. Aí, na primeira vez que
  // aparecesse UM atrasado, o contador já estaria alto e o alarme dispararia
  // na hora — justamente o alarme falso que esta função existe para evitar.
  if (atrasados === 0) {
    await pool.query(
      `INSERT INTO guardiao_tendencia (chave, valor, repeticoes) VALUES ('quentes-atrasados', 0, 0)
       ON DUPLICATE KEY UPDATE valor = 0, repeticoes = 0, medido_em = CURRENT_TIMESTAMP`,
    );
    return { status: "ok", detail: "quentes em dia" };
  }

  const semMelhora = await tendencia("quentes-atrasados", atrasados);
  if (semMelhora === 0) return { status: "ok", detail: `${atrasados} quente(s) atrasado(s), mas diminuindo` };
  if (semMelhora < CHECAGENS_SEM_MELHORA) {
    return { status: "ok", detail: `${atrasados} quente(s) atrasado(s), parado há ${semMelhora} verificação(ões)` };
  }

  const detalhe =
    `${atrasados} produto(s) quente(s) atrasado(s) e o número NÃO cai há ` +
    `${semMelhora} verificações (${semMelhora * INTERVALO_MIN} min)`;
  await registrar("quentes", "sem-progresso", detalhe, "nenhuma-precisa-de-olho-humano");
  return { status: "sem-progresso", detail: detalhe };
}

// LAÇO DE REINÍCIO — o outro ponto cego de 07/08/2026.
//
// O guardião já limita as PRÓPRIAS religadas (MAX_RELIGADAS_HORA). O que ele
// não enxergava é que **quem reiniciava 214 vezes era o PM2**, sozinho, porque
// o processo morria ao subir. Do lado de fora tudo parecia "online".
//
// Reiniciar não conserta defeito de código. Aqui ele reconhece o laço, PARA de
// tentar e deixa registrado — para o dono ver em vez de descobrir por acaso.
const reiniciosAntes = new Map<string, number>();

async function conferirLacoDeReinicio(): Promise<{ status: string; detail: string }> {
  let apps: Array<{ name: string; pm2_env?: { restart_time?: number } }>;
  try {
    const { stdout } = await execAsync("pm2 jlist", { timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
    apps = JSON.parse(stdout);
  } catch {
    return { status: "ok", detail: "pm2 não respondeu" };
  }

  const emLaco: string[] = [];
  for (const a of apps) {
    const agora = Number(a.pm2_env?.restart_time ?? 0);
    const antes = reiniciosAntes.get(a.name);
    reiniciosAntes.set(a.name, agora);
    // Primeira passagem só anota: sem "antes" não há como saber o ritmo.
    if (antes == null) continue;
    const novos = agora - antes;
    if (novos >= REINICIOS_LACO) emLaco.push(`${a.name}: ${novos} reinícios desde a última conferência`);
  }

  if (!emLaco.length) return { status: "ok", detail: "sem laço de reinício" };
  await registrar("laco-de-reinicio", "em-laco", emLaco.join(" · "), "nenhuma-nao-adianta-religar");
  return {
    status: "em-laco",
    detail: `${emLaco.join(" · ")} — religar não resolve, precisa de olho humano`,
  };
}

// ---------------------------------------------------------------------------

// CONFERE CADA ROBÔ SEPARADAMENTE (05/08/2026).
//
// ⚠ O PONTO CEGO QUE ISTO FECHA: a checagem abaixo lê `scrape_control`, que é
// UMA linha para os quatro robôs. Enquanto eles eram iguais isso bastava — se
// um caía, os outros cobriam o trabalho. Depois que passaram a ter PAPEL (um só
// para produtos quentes, outro só para novos), o arranjo virou perigoso: o robô
// dos quentes podia travar e, como os outros continuavam batendo na mesma
// linha, o guardião lia "sinal fresco" e concluía que estava tudo bem — com os
// preços que MAIS importam envelhecendo sem ninguém perceber.
//
// Aqui cada robô é julgado por DOIS critérios:
//   · batimento — está vivo?
//   · produção  — fechou uma volta dentro do tempo esperado do papel dele?
// O segundo é o que pega "vivo mas parado", que o primeiro nunca pegaria.
// Tetos com o DOBRO da duração real medida, não o dobro da que eu imaginava.
// A volta dos quentes leva ~2h33 (medido em 05/08 depois do conserto dos dois
// sublinhados), então 3h era apertado demais — e a volta dos novos ficou em
// ~40 min desde que as marcas passaram a rodar 1x por dia.
const TETO_POR_PAPEL: Record<string, number> = {
  quentes: num(process.env.GUARD_CICLO_QUENTES_MIN, 360), // volta de ~2h33
  novos: num(process.env.GUARD_CICLO_NOVOS_MIN, 120), // volta de ~40 min
  normal: num(process.env.GUARD_CICLO_NORMAL_MIN, 10080), // uma volta leva dias
};

async function conferirRobos(): Promise<{ status: string; detail: string }> {
  const robos = await pool.query(
    `SELECT worker_id, papel, message,
            TIMESTAMPDIFF(SECOND, heartbeat_at, NOW()) AS idade,
            -- O MAIS RECENTE dos dois, não o fechamento primeiro.
            --
            -- ⚠ ISTO CRIOU UM LAÇO EM PRODUÇÃO (05/08/2026): com COALESCE, um
            -- ciclo fechado há 5h "vencia" um ciclo ABERTO há 10 minutos. O
            -- guardião concluía que o robô dos quentes estava parado, reiniciava
            -- — e o reinício abortava justamente a volta em andamento, que então
            -- nunca fechava. Ele se reiniciava para sempre por causa de uma
            -- volta que ele mesmo impedia de terminar. Só não virou desastre
            -- porque o limite de "religando demais" segurou.
            --
            -- Volta ABERTA é sinal de trabalho tanto quanto volta fechada: o
            -- que se mede aqui é "há quanto tempo esta volta está correndo",
            -- e o teto por papel é o dobro da duração real dela.
            --
            -- ⚠ NÃO incluir o heartbeat_at neste GREATEST: ele está sempre
            -- fresco num robô vivo, e isso anularia justamente a checagem de
            -- "vivo mas parado", que é a razão de este bloco existir.
            TIMESTAMPDIFF(MINUTE, GREATEST(
              COALESCE(ciclo_fechado_em, '1970-01-01'),
              COALESCE(ciclo_aberto_em,  '1970-01-01')
            ), NOW()) AS desdeCiclo
       FROM crawl_robo`,
  );
  if (!robos.length) return { status: "ok", detail: "nenhum robô registrado ainda" };

  const problemas: string[] = [];
  for (const r of robos) {
    const papel = String(r.papel ?? "normal");
    const idade = r.idade == null ? null : Number(r.idade);
    const desdeCiclo = r.desdeCiclo == null ? null : Number(r.desdeCiclo);
    const nome = `robô ${r.worker_id} (${papel})`;

    if (idade == null || idade > SEM_SINAL_SEG) {
      problemas.push(`${nome}: sem sinal há ${idade ?? "?"}s`);
      continue;
    }
    const teto = TETO_POR_PAPEL[papel] ?? TETO_POR_PAPEL.normal;
    if (desdeCiclo != null && desdeCiclo > teto) {
      problemas.push(`${nome}: vivo mas sem fechar volta há ${desdeCiclo} min (teto ${teto})`);
    }
  }

  if (!problemas.length) return { status: "ok", detail: `${robos.length} robô(s) trabalhando` };

  // Religar a turma inteira continua sendo a ação certa: eles dividem uma fila
  // e um teto de pedidos, e subir um sozinho sem saber o estado dos outros é
  // mais arriscado do que reiniciar todos, o que leva segundos.
  const acao = await religar(NOME_DOS_COLETORES, "robos", problemas.join(" · "));
  return { status: "travado", detail: `${problemas.join(" · ")}; ação: ${acao}` };
}

async function conferirColetor(): Promise<{ status: string; detail: string }> {
  const linhas = await pool.query(
    `SELECT state, stop_requested, message, started_at,
            TIMESTAMPDIFF(SECOND, heartbeat_at, NOW()) AS idade,
            TIMESTAMPDIFF(MINUTE, started_at, NOW()) AS minutosLigado
       FROM scrape_control WHERE id = 1`,
  );
  if (!linhas.length) return { status: "ok", detail: "coletor nunca foi iniciado" };
  const c = linhas[0];
  const idade = c.idade == null ? null : Number(c.idade);
  const mensagem = String(c.message ?? "");

  // Parado de propósito pelo painel: respeitar a decisão de quem parou.
  if (c.state === "idle" && /parado pelo painel/i.test(mensagem)) {
    return { status: "parado-pelo-usuario", detail: "parado pelo painel — não vou religar" };
  }

  if (c.state === "idle") {
    const r = await religar(NOME_DOS_COLETORES, "coletor", `estava desligado (${mensagem || "sem mensagem"})`);
    return { status: "caido", detail: `desligado; ação: ${r}` };
  }

  if (idade == null || idade > SEM_SINAL_SEG) {
    const r = await religar(
      NOME_DOS_COLETORES,
      "coletor",
      `sem sinal de vida há ${idade ?? "?"}s (última mensagem: ${mensagem})`,
    );
    return { status: "travado", detail: `sem sinal há ${idade ?? "?"}s; ação: ${r}` };
  }

  // Vivo. Se está reiniciando toda hora, religar não resolve — só avisa.
  const ligadoHa = Number(c.minutosLigado ?? 0);
  if (ligadoHa < 15) {
    const [q] = await pool.query(
      "SELECT COUNT(*) n FROM watchdog_log WHERE target = 'coletor' AND status IN ('travado','caido') AND happened_at > NOW() - INTERVAL 2 HOUR",
    );
    if (Number(q.n) >= 3) {
      await registrar("coletor", "instavel", `caiu ${q.n}x em 2h — precisa de olhada humana`, "nenhuma");
      return { status: "instavel", detail: `caiu ${q.n}x nas últimas 2h` };
    }
  }

  return { status: "ok", detail: mensagem };
}

// POR QUAL IP O COLETOR ESTÁ SAINDO — e quantas vezes isso mudou.
//
// O dono pediu isso ao montar o proxy: "quero no monitor quantas vezes trocou
// de IP pra eu saber". Em 08/08/2026 fui conferir e o painel mostrava ZERO
// enquanto o registro de Dallas tinha SETE trocas no mesmo dia. O rodízio
// funcionava; o contador é que media outra coisa (ver migração 047).
//
// A pergunta é feita ATRAVÉS DO PRÓPRIO PROXY. Isso tem três vantagens sobre
// mandar Dallas avisar o iCompras: não abre porta nenhuma, não inventa senha
// entre os dois servidores, e mede do ponto de vista de quem interessa — se o
// coletor consegue sair, a medida sai junto; se não consegue, o silêncio já é
// a informação.
//
// ⚠ NUNCA devolve status diferente de "ok". Trocar de IP é o comportamento
// esperado, não é incidente — se isto acendesse alarme, o guardião passaria a
// gritar de 5 em 5 horas por causa do rodízio normal.
async function conferirIpDaSaida(): Promise<{ status: string; detail: string }> {
  const proxy = process.env.CRAWL_PROXY ?? "";
  if (!proxy) return { status: "ok", detail: "saída direta" };

  let ip: string | null = null;
  try {
    if (!despachante) despachante = new ProxyAgent(proxy);
    const res = await buscarNaWeb(ONDE_PERGUNTO_MEU_IP, {
      dispatcher: despachante,
      signal: AbortSignal.timeout(ESPERA_DO_IP_MS),
    });
    if (res.ok) {
      const texto = (await res.text()).trim();
      // Só aceita o que TEM CARA de endereço. Se o serviço responder uma
      // página de erro, gravar aquilo como "IP atual" contaria uma troca
      // falsa agora e outra quando voltasse ao normal.
      if (/^[0-9a-fA-F.:]{7,45}$/.test(texto)) ip = texto;
    }
  } catch (e) {
    /* Dallas lento ou fora do ar. Não é problema DAQUI: quem trata a queda do
       proxy é o coletor, que passa a sair direto e registra em `modo`. Aqui
       apenas não medimos desta vez — e `ip_visto_em` fica velho, que é o que
       o painel mostra.

       ⚠ Mas DEIXA RASTRO. Na primeira versão este catch era mudo, o limite de
       espera estava curto demais e a medida falhava toda vez: o painel ficava
       vazio e não havia uma linha sequer dizendo por quê. Uma verificação que
       falha em silêncio é pior que verificação nenhuma. */
    console.log(`saída: não consegui medir o IP pelo proxy — ${(e as Error).message}`);
  }

  if (!ip) return { status: "ok", detail: "IP não medido" };

  const [linha] = await pool.query("SELECT ip_atual FROM coletor_saida WHERE id = 1");
  const anterior: string | null = linha?.ip_atual ?? null;

  if (anterior === ip) {
    await pool.query("UPDATE coletor_saida SET ip_visto_em = NOW() WHERE id = 1");
    return { status: "ok", detail: `IP ${ip}` };
  }

  // A PRIMEIRA medida não é troca: não havia com o que comparar. Sem esta
  // ressalva, todo reinício do guardião inventaria uma troca.
  if (anterior == null) {
    await pool.query("UPDATE coletor_saida SET ip_atual = ?, ip_visto_em = NOW() WHERE id = 1", [ip]);
    return { status: "ok", detail: `IP ${ip}` };
  }

  await pool.query(
    `UPDATE coletor_saida
        SET ip_atual = ?, ip_visto_em = NOW(),
            trocas_ip = trocas_ip + 1, ultima_troca_ip = NOW()
      WHERE id = 1`,
    [ip],
  );
  console.log(`saída trocou de IP: ${anterior} → ${ip}`);
  return { status: "ok", detail: `IP mudou: ${anterior} → ${ip}` };
}

async function conferirSite(): Promise<{ status: string; detail: string }> {
  try {
    const ctrl = AbortSignal.timeout(15000);
    const res = await fetch(SITE_URL, { signal: ctrl });
    if (res.ok) return { status: "ok", detail: `site respondeu ${res.status}` };
    const r = await religar("icompras-web", "site", `site respondeu ${res.status}`);
    return { status: "com-erro", detail: `HTTP ${res.status}; ação: ${r}` };
  } catch (e) {
    const r = await religar("icompras-web", "site", `site não respondeu (${(e as Error).message})`);
    return { status: "fora-do-ar", detail: `sem resposta; ação: ${r}` };
  }
}

// Auditoria de cobertura: confere se alguma categoria da fonte está rendendo
// produto lá e nada aqui. Domingo de madrugada, uma vez por semana.
//
// Sai em processo separado DE PROPÓSITO: a auditoria leva uns 15 minutos e o
// guardião não pode ficar esse tempo sem vigiar o coletor. O registro
// "iniciada" entra no banco antes de soltar o processo, e é ele que impede
// uma segunda largada — mesmo que a auditoria morra no meio, não repete.
// REDE DE SEGURANÇA: oferta que ninguém vê há muito tempo sai do ar.
//
// A marcação EXATA é do coletor (ver `marcarQueSumiram` em crawl.ts): leu a
// página, a loja não estava na lista, tirou do ar na hora. Isto aqui cobre o
// que o coletor não consegue nem abrir — página que virou 404, produto que
// saiu inteiro da fonte. Aí não há lista com que comparar, e só sobra o tempo.
//
// ⚠ O PRAZO É FOLGADO DE PROPÓSITO. Medido em 08/08/2026: 93,7% das ofertas
// foram vistas nos últimos 7 dias, mas 6,4% estavam entre 7 e 30 dias — e a
// volta completa do coletor às vezes passa de uma semana. Um prazo de 7 dias
// tiraria do ar 20 mil ofertas boas na primeira noite. Por isso 21 dias: nesta
// faixa não sobra quase nada que seja só atraso de coleta. Dá para apertar
// depois, com a evidência do monitor (quantas voltam) — não antes.
const BAIXA_DIAS = num(process.env.GUARD_BAIXA_DIAS, 21);
const BAIXA_HORA = num(process.env.GUARD_BAIXA_HORA, 4); // 4h: ninguém olhando
// Mesmo teto do coletor, pelo mesmo motivo. Ver TETO_BAIXA_PCT em crawl.ts.
const BAIXA_TETO_PCT = num(process.env.GUARD_BAIXA_TETO_PCT, 5);

async function talvezTirarDoArPorTempo(): Promise<void> {
  const agora = new Date();
  if (agora.getHours() !== BAIXA_HORA) return;
  // O guardião passa aqui a cada 5 min: sem esta janela seriam 12 execuções
  // na mesma hora.
  const [j] = await pool.query(
    "SELECT COUNT(*) n FROM watchdog_log WHERE target = 'baixas' AND status IN ('varredura','teto-atingido') AND happened_at > NOW() - INTERVAL 12 HOUR",
  );
  if (Number(j.n) > 0) return;

  // Quantas SERIAM tiradas do ar — conta antes de mexer, para o teto poder
  // barrar. Contar e depois marcar não é atômico, mas o teto é um freio de
  // ordem de grandeza; alguns segundos de diferença não mudam a decisão.
  const [c] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM offer
              WHERE in_stock = 1 AND source = 'scraped'
                AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL ? DAY)) AS alvo,
            (SELECT COUNT(*) FROM offer) AS total`,
    [BAIXA_DIAS],
  );
  const alvo = Number(c?.alvo ?? 0);
  const total = Number(c?.total ?? 0) || 1;
  if (!alvo) {
    await registrar("baixas", "varredura", `nenhuma oferta parada há mais de ${BAIXA_DIAS} dias`, "nenhuma");
    return;
  }

  const pct = (100 * alvo) / total;
  if (pct >= BAIXA_TETO_PCT) {
    await registrar(
      "baixas",
      "teto-atingido",
      `${alvo} ofertas passariam de ${BAIXA_DIAS} dias (${pct.toFixed(1)}% do catálogo, teto ${BAIXA_TETO_PCT}%) — NÃO marquei nada`,
      "parei-de-marcar",
    );
    return;
  }

  const r = await pool.query(
    `UPDATE offer
        SET in_stock = 0, gone_at = NOW(), gone_reason = 'tempo'
      WHERE in_stock = 1 AND source = 'scraped'
        AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL ? DAY)`,
    [BAIXA_DIAS],
  );
  const n = Number(r?.affectedRows ?? 0);
  await registrar(
    "baixas",
    "varredura",
    `${n} oferta(s) fora do ar: ninguém as via há mais de ${BAIXA_DIAS} dias (${pct.toFixed(1)}% do catálogo)`,
    "marcadas",
  );
}

// CONFERÊNCIA DIÁRIA DAS BAIXAS — a regra se vigiando.
//
// Pega uma amostra do que foi tirado do ar, baixa a página do anúncio na fonte
// e cruza os dois lados: as lojas que retirei não podem aparecer, e as que
// mantive têm de aparecer. O segundo lado é o que pega o defeito silencioso —
// leitura truncada some com loja boa sem nunca acusar erro.
//
// Roda às 5h, depois da varredura das 4h, para conferir inclusive o que ela
// acabou de marcar.
//
// ⚠ SAI PELO PROXY, como todo o resto que fala com a fonte. São ~8 páginas por
// dia — ao lado das milhares do coletor, é ruído.
const CONF_HORA = num(process.env.GUARD_CONF_HORA, 5);
const CONF_ANUNCIOS = num(process.env.GUARD_CONF_ANUNCIOS, 8);
/** Teto de tempo: o guardião não pode ficar minutos sem vigiar o coletor. */
const CONF_LIMITE_MS = num(process.env.GUARD_CONF_LIMITE_MS, 120_000);

/**
 * Nome curto demais vira coincidência dentro do HTML (uma loja "Ari" casaria
 * com "Ariel", "Arica"...). Abaixo disto a conferência não opina.
 */
function nomeConferivel(nome: string) {
  return nome.trim().length >= 4;
}

/**
 * A loja aparece na página como VENDEDORA?
 *
 * ⚠ Compara o nome INTEIRO, entre aspas, na etiqueta `'advertiser': '...'`.
 * A primeira versão procurava o nome solto no HTML, e em 10/08/2026 isso
 * acusou "Mega Eletro" como erro por ele estar dentro de "Mega Eletrônicos" —
 * um alarme falso em 4, num total de 25. Verificador que grita à toa é
 * verificador que a gente aprende a ignorar, e aí ele não serve para nada.
 */
function apareceComoVendedora(html: string, loja: string) {
  return html.includes(`'advertiser': '${loja.trim()}'`);
}

async function talvezConferirAsBaixas(): Promise<void> {
  const agora = new Date();
  if (agora.getHours() !== CONF_HORA) return;
  const [j] = await pool.query("SELECT COUNT(*) n FROM baixa_auditoria WHERE day = CURDATE()");
  if (Number(j?.n ?? 0) > 0) return;
  const proxy = process.env.CRAWL_PROXY ?? "";
  if (!proxy) return;

  // Uma oferta retirada por anúncio, das mais recentes: é o que ainda não foi
  // reconferido pelo próprio coletor.
  const alvos = await pool.query(
    `SELECT o.external_id AS ext, MIN(s.name) AS loja
       FROM offer o JOIN store s ON s.id = o.store_id
      WHERE o.in_stock = 0 AND o.gone_at > NOW() - INTERVAL 2 DAY
      GROUP BY o.external_id
      ORDER BY MAX(o.gone_at) DESC
      LIMIT ?`,
    [CONF_ANUNCIOS],
  );
  if (!alvos.length) return;

  const ateQuando = Date.now() + CONF_LIMITE_MS;
  let conferidas = 0;
  let erradas = 0;
  let mantidasOk = 0;
  let mantidas = 0;
  let anuncios = 0;
  const problemas: string[] = [];

  for (const a of alvos) {
    if (Date.now() > ateQuando) break; // acabou o tempo: vale o que deu
    const id = String(a.ext).replace(/^cp-/, "");
    let html = "";
    try {
      if (!despachante) despachante = new ProxyAgent(proxy);
      const res = await buscarNaWeb(`https://www.comprasparaguai.com.br/x_${id}/`, {
        dispatcher: despachante,
        signal: AbortSignal.timeout(60_000),
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      if (res.ok) html = await res.text();
    } catch {
      /* página fora do ar ou proxy lento: esta não conta */
    }
    // Página curta demais é erro de carregamento, não catálogo. Contá-la diria
    // "nenhuma loja aparece" e acusaria erro em tudo que mantive.
    if (html.length < 5000) continue;
    anuncios++;

    const lojas = await pool.query(
      `SELECT s.name AS nome, o.in_stock AS noAr
         FROM offer o JOIN store s ON s.id = o.store_id
        WHERE o.external_id = ?`,
      [a.ext],
    );
    for (const l of lojas) {
      const nome = String(l.nome);
      if (!nomeConferivel(nome)) continue;
      const aparece = apareceComoVendedora(html, nome);
      if (Number(l.noAr) === 0) {
        conferidas++;
        if (aparece) {
          erradas++;
          if (problemas.length < 4) problemas.push(`${nome} em x_${id}`);
        }
      } else {
        mantidas++;
        if (aparece) mantidasOk++;
      }
    }
  }

  if (!anuncios) return; // nem uma página baixou: não inventa placar

  const detalhe = erradas
    ? `⛔ ${erradas} de ${conferidas} ainda apareciam na fonte: ${problemas.join(", ")}`
    : `${conferidas} retiradas conferidas, nenhuma na fonte · ${mantidasOk}/${mantidas} mantidas conferidas`;

  await pool.query(
    `INSERT INTO baixa_auditoria (day, conferidas, erradas, mantidas_ok, mantidas, anuncios, detalhe)
     VALUES (CURDATE(), ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE conferidas = VALUES(conferidas), erradas = VALUES(erradas),
       mantidas_ok = VALUES(mantidas_ok), mantidas = VALUES(mantidas),
       anuncios = VALUES(anuncios), detalhe = VALUES(detalhe)`,
    [conferidas, erradas, mantidasOk, mantidas, anuncios, detalhe.slice(0, 500)],
  );
  // Só vira incidente quando há erro; conferência limpa não polui o histórico.
  if (erradas) await registrar("baixas", "conferencia-acusou", detalhe, "nenhuma");
  console.log(`conferência das baixas: ${detalhe}`);
}

// O VÍDEO DA PONTE AINDA EXISTE?
//
// A câmera ao vivo da home é de um canal de TERCEIROS (ver a seção do vídeo na
// memória). Se ele apagar a transmissão, torná-la privada ou desligar o
// compartilhamento, a caixinha passa a mostrar erro em vez da ponte — e o dono
// só descobriria abrindo o site.
//
// ⚠ O QUE ISTO DETECTA, E O QUE NÃO DETECTA. Uso o oEmbed do YouTube, que
// responde 200 enquanto o vídeo existir e puder ser embutido. Isso pega vídeo
// apagado, privado ou com embed bloqueado — as falhas que quebram a tela.
//
// **Não pega transmissão que simplesmente ACABOU**: para o YouTube ela vira um
// vídeo gravado normal, e o oEmbed segue devolvendo 200. Saber que não está
// mais ao vivo exigiria ler a página do vídeo, e o YouTube devolve
// "LOGIN_REQUIRED" para pedidos vindos de servidor (testado em 08/08/2026).
// Prefiro entregar a metade que funciona a fingir que cobre tudo.
const VIDEO_HORA = num(process.env.GUARD_VIDEO_HORA, 6);

async function talvezConferirOVideo(): Promise<void> {
  const agora = new Date();
  if (agora.getHours() !== VIDEO_HORA) return;
  const [j] = await pool.query(
    "SELECT COUNT(*) n FROM watchdog_log WHERE target = 'video' AND happened_at > NOW() - INTERVAL 12 HOUR",
  );
  if (Number(j?.n ?? 0) > 0) return;

  const banners = await pool.query(
    "SELECT id, title, link_url FROM banner WHERE placement = 'video_flutuante' AND active = 1",
  );
  if (!banners.length) return;

  for (const b of banners) {
    const url = String(b.link_url ?? "");
    if (!url) continue;

    let vivo = false;
    try {
      const res = await buscarNaWeb(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { signal: AbortSignal.timeout(20_000) },
      );
      vivo = res.ok;
    } catch {
      vivo = false; // rede falhou: trata como suspeita, não como certeza
    }

    if (vivo) continue;

    // DUAS FALHAS ANTES DE DESLIGAR. Uma falha isolada pode ser instabilidade
    // do YouTube ou da nossa rede, e desligar o banner por causa disso seria
    // trocar um problema pequeno por outro. Só desliga se ontem também falhou.
    const [ontem] = await pool.query(
      `SELECT COUNT(*) n FROM watchdog_log
        WHERE target = 'video' AND status = 'suspeito'
          AND detail LIKE ? AND happened_at > NOW() - INTERVAL 3 DAY`,
      [`%${url}%`],
    );
    if (Number(ontem?.n ?? 0) === 0) {
      await registrar("video", "suspeito", `não respondeu: ${url}`, "nenhuma");
      continue;
    }

    await pool.query("UPDATE banner SET active = 0 WHERE id = ?", [b.id]);
    await registrar(
      "video",
      "desligado",
      `"${b.title}" saiu do ar no YouTube (segunda falha seguida) — banner desativado`,
      "banner-desativado",
    );
    console.log(`vídeo "${b.title}" fora do ar no YouTube — desliguei o banner`);
  }
}

// VISITANTE QUE DESISTIU DE ESPERAR — o alarme que faltava.
//
// ⚠ POR QUE ISTO EXISTE (12/08/2026). O site passou a levar de 11 a 34 segundos
// por página e **ninguém avisou**: o guardião via o site respondendo 200 e dava
// tudo certo. Quem percebeu foi o dono, olhando. Só depois, no registro do
// nginx, apareceu o tamanho do estrago: numa única hora, **797 desistências de
// 70 pessoas diferentes** — cada uma abriu, esperou, fechou e tentou de novo em
// média 11 vezes. Em hora normal o dia inteiro tem de 3 a 9.
//
// 💡 O CÓDIGO 499 do nginx é "o visitante fechou antes da resposta chegar". É a
// única medida que existe do que o visitante SENTIU: não é tempo de resposta
// médio, não é uso de processador — é gente desistindo. Um site pode responder
// 200 em todas as páginas e estar perdendo todo mundo, que foi exatamente o
// caso. Vigiar saúde de processo não pega isso; vigiar desistência pega.
//
// ⚠ EXIGE AS DUAS COISAS: muitas desistências **e** muitas pessoas distintas.
// Uma pessoa só, com internet ruim, gera dezenas de 499 sozinha e não é
// problema do site. O que caracteriza o incidente é ser em GENTE DIFERENTE.
//
// Olha a hora cheia anterior, não os últimos 60 minutos: hora pela metade tem
// pouca amostra e dispararia alarme falso de madrugada, quando 5 desistências
// já são "muitas" proporcionalmente.
const DESISTENCIA_MIN = num(process.env.GUARD_ABANDON_MIN, 60);
const DESISTENCIA_PESSOAS = num(process.env.GUARD_ABANDON_PEOPLE, 10);
const REGISTRO_NGINX = process.env.GUARD_NGINX_LOG ?? "/var/log/nginx/access.log";
// Quanto do fim do arquivo ler. Em hora de pico o site faz ~29 mil pedidos/h,
// então 300 mil linhas cobrem com folga as últimas horas sem ler os 28 MB.
const LINHAS_DO_FIM = num(process.env.GUARD_NGINX_TAIL, 300_000);

async function conferirDesistencias(): Promise<{ status: string; detail: string }> {
  if (process.platform === "win32") return { status: "ok", detail: "desistências: não medido no Windows" };

  // A hora cheia que acabou de passar, no formato do nginx: 12/Aug/2026:11
  const h = new Date(Date.now() - 60 * 60 * 1000);
  const meses = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const alvo =
    `${String(h.getUTCDate()).padStart(2, "0")}/${meses[h.getUTCMonth()]}/` +
    `${h.getUTCFullYear()}:${String(h.getUTCHours()).padStart(2, "0")}`;

  let desistencias = 0;
  let pessoas = 0;
  try {
    // Campos do nginx: $1 = quem pediu, $4 = "[12/Aug/2026:12:42:40", $9 = código.
    //
    // ⚠ SEM EXPRESSÃO REGULAR AQUI, de propósito. A primeira versão comparava
    // `$0 ~ "\\[" alvo` e **nunca disparava**: o colchete precisa de escape no
    // regex, o escape precisa sobreviver ao TypeScript e ao shell antes de
    // chegar ao awk, e no caminho ele virava `[` solto — "invalid regexp:
    // Unmatched [". Testado contra a hora real do incidente, dava 0 de 0.
    // Alarme que nunca toca é pior que alarme nenhum, porque cala. Comparar o
    // campo direto não tem escape para errar: "12/Aug/2026:11" são 14 letras
    // a partir da segunda posição de $4.
    const { stdout } = await execAsync(
      `tail -n ${LINHAS_DO_FIM} ${REGISTRO_NGINX} | awk -v a='${alvo}' 'substr($4,2,14) == a && $9 == 499 {n++; ip[$1]=1} END {print n+0, length(ip)}'`,
      { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const [a, b] = stdout.trim().split(/\s+/).map(Number);
    desistencias = a || 0;
    pessoas = b || 0;
  } catch (e) {
    // Registro ilegível não é incidente do site — não inventar alarme.
    return { status: "ok", detail: `desistências: não consegui ler (${(e as Error).message.slice(0, 40)})` };
  }

  const resumo = `${desistencias} desistências de ${pessoas} pessoas na hora ${alvo.slice(-2)}h UTC`;
  if (desistencias < DESISTENCIA_MIN || pessoas < DESISTENCIA_PESSOAS) {
    return { status: "ok", detail: `desistências: ${desistencias} (${pessoas} pessoas)` };
  }

  // Uma vez por hora, não a cada passagem do guardião (que é de 5 em 5 min).
  const [j] = await pool.query(
    "SELECT COUNT(*) n FROM watchdog_log WHERE target = 'desistencias' AND happened_at > NOW() - INTERVAL 55 MINUTE",
  );
  if (Number(j?.n ?? 0) === 0) {
    await registrar(
      "desistencias",
      "visitantes-desistindo",
      `${resumo} — o site está respondendo, mas devagar demais para as pessoas esperarem`,
      "nenhuma-precisa-de-olho-humano",
    );
  }
  return { status: "visitantes-desistindo", detail: resumo };
}

// BLOQUEIOS DA FONTE VOLTANDO A SUBIR.
//
// ⚠ POR QUE ISTO EXISTE (13/08/2026). A fonte bloqueou a coleta 401 vezes entre
// 08 e 11/08 e **ninguém soube enquanto acontecia**. O painel mostrava só um
// total acumulado, que não distingue "está acontecendo agora" de "aconteceu
// semana passada". O dono viu o número dias depois e perguntou se havia
// problema — a essa altura já tinha passado.
//
// O custo desse silêncio foi medido: as 155 unidades do mapa que falharam em
// 11/08 (70.570 anúncios perdidos) rodaram dentro da janela de bloqueio. Um
// aviso na hora teria ligado as duas coisas no mesmo dia.
//
// 💡 O padrão que se repete neste projeto: **o dado existia e ninguém foi
// avisado.** Foi assim com a lentidão (o site respondia 200 e o guardião dava
// tudo certo), com as unidades que falhavam caladas, e agora com os bloqueios.
// Medir não basta; alguém precisa ser chamado quando o número vira problema.
const BLOQUEIO_POR_HORA = num(process.env.GUARD_BLOCK_PER_HOUR, 20);

async function conferirBloqueios(): Promise<{ status: string; detail: string }> {
  const [r] = await pool.query(
    `SELECT COALESCE(SUM(quantos), 0) AS n, MAX(modo) AS modo, MAX(ip) AS ip
       FROM coletor_bloqueio_hora WHERE hora > NOW() - INTERVAL 2 HOUR`,
  ).catch(() => [null]);

  const n = Number(r?.n ?? 0);
  if (n < BLOQUEIO_POR_HORA) return { status: "ok", detail: `bloqueios: ${n} nas últimas 2h` };

  // Uma vez por hora, não a cada passagem (que é de 5 em 5 min).
  const [j] = await pool.query(
    "SELECT COUNT(*) n FROM watchdog_log WHERE target = 'bloqueios' AND happened_at > NOW() - INTERVAL 55 MINUTE",
  );
  if (Number(j?.n ?? 0) === 0) {
    // ⚠ A distinção que muda o que fazer: se o IP mudou e o bloqueio continua,
    // trocar de novo não adianta — é bloqueio por comportamento, não por
    // endereço. Sem isso alguém passa dias trocando IP atrás do problema errado.
    const [trocou] = await pool.query(
      `SELECT COUNT(DISTINCT ip) AS ips FROM coletor_bloqueio_hora
        WHERE hora > NOW() - INTERVAL 6 HOUR AND ip IS NOT NULL`,
    ).catch(() => [null]);
    const ips = Number(trocou?.ips ?? 1);
    const leitura =
      ips > 1
        ? `já foram ${ips} endereços diferentes e continua — provavelmente NÃO é bloqueio por IP`
        : "mesmo endereço o tempo todo — trocar de IP deve resolver";
    await registrar(
      "bloqueios",
      "fonte-bloqueando",
      `${n} bloqueios (403) nas últimas 2h saindo por ${r?.modo ?? "?"} — ${leitura}`,
      "nenhuma-precisa-de-olho-humano",
    );
  }
  return { status: "fonte-bloqueando", detail: `bloqueios: ${n} nas últimas 2h` };
}

async function talvezAuditar(): Promise<void> {
  const agora = new Date();
  if (agora.getDay() !== AUDIT_DIA || agora.getHours() !== AUDIT_HORA) return;

  // 12 horas, e não "3 dias": a janela só precisa cobrir a hora do gatilho
  // (o guardião passa aqui a cada 5 min, então seriam 12 largadas na mesma
  // hora sem isto). Uma janela de dias pareceria mais segura, mas cancelaria
  // o domingo sempre que alguém tivesse rodado a auditoria na mão na véspera.
  const [r] = await pool.query(
    "SELECT COUNT(*) n FROM watchdog_log WHERE target = 'auditoria' AND happened_at > NOW() - INTERVAL 12 HOUR",
  );
  if (Number(r.n) > 0) return;

  await registrar("auditoria", "iniciada", "auditoria semanal de cobertura do catálogo", "nenhuma");
  try {
    const filho = spawn("npm", ["run", "auditoria", "-w", "@icompras/worker"], {
      cwd: RAIZ,
      detached: true,
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    filho.unref();
  } catch (e) {
    await registrar("auditoria", "erro", `não consegui iniciar: ${(e as Error).message}`, "nenhuma");
  }
}

async function verificar(): Promise<void> {
  // ⚠ O BANCO VEM PRIMEIRO, e a ordem não é detalhe.
  //
  // Em 07/08/2026 o robô aparecia "sem sinal" porque estava ESPERANDO uma
  // transação travada. Se o guardião conferir o robô antes, ele conclui
  // "travado" e reinicia — tratando o sintoma e deixando a causa de pé.
  // Destravando o banco primeiro, na mesma passagem o robô costuma voltar
  // sozinho e nem chega a ser religado à toa.
  const banco = await conferirBanco();
  const laco = await conferirLacoDeReinicio();
  const atrasados = await conferirAtrasados();
  const coletor = await conferirColetor();
  // Só vale conferir robô por robô se o coletor não estiver parado de
  // propósito — senão o guardião religaria o que o dono desligou no painel.
  const robos =
    coletor.status === "parado-pelo-usuario"
      ? { status: "ok", detail: "parado pelo painel" }
      : await conferirRobos();
  const site = await conferirSite();
  // ⚠ `site` só diz que o site RESPONDE. Isto diz se as pessoas estão
  // conseguindo esperar pela resposta — foi o que faltou em 12/08/2026.
  const desistencias = await conferirDesistencias();
  const bloqueios = await conferirBloqueios();
  const vps = await conferirLimites();
  // Fora da lista de problemas de propósito: só ANOTA por qual IP a coleta
  // está saindo. Ver o comentário da função.
  const saida = await conferirIpDaSaida();
  await talvezTirarDoArPorTempo();
  await talvezConferirAsBaixas();
  await talvezConferirOVideo();
  await talvezAuditar();

  const problemas = [banco, laco, coletor, robos, site, vps, atrasados, desistencias, bloqueios].filter(
    (v) => v.status !== "ok" && v.status !== "parado-pelo-usuario",
  );
  const status = problemas.length ? problemas[0].status : coletor.status === "ok" ? "ok" : coletor.status;
  const detalhe =
    `coletor: ${coletor.detail} · robôs: ${robos.detail} · site: ${site.detail}` +
    ` · servidor: ${vps.detail} · banco: ${banco.detail} · ${atrasados.detail}` +
    ` · ${desistencias.detail} · ${bloqueios.detail}` +
    ` · saída: ${saida.detail}` +
    (laco.status === "ok" ? "" : ` · ⚠ ${laco.detail}`);
  if (vps.status !== "ok") await registrar("servidor", vps.status, vps.detail, "nenhuma");

  await pool.query(
    `UPDATE watchdog_state SET last_check_at = NOW(), status = ?, detail = ?, checks = checks + 1 WHERE id = 1`,
    [status, detalhe.slice(0, 500)],
  );
  // Mantém o histórico enxuto.
  await pool.query("DELETE FROM watchdog_log WHERE happened_at < NOW() - INTERVAL 30 DAY");
}

async function main(): Promise<void> {
  console.log(
    `Guardião iCompras — verifica a cada ${INTERVALO_MIN} min · ` +
      `considera travado após ${SEM_SINAL_SEG}s sem sinal · no máximo ${MAX_RELIGADAS_HORA} religadas/hora · ` +
      `auditoria de catálogo no dia ${AUDIT_DIA} (0=domingo) às ${AUDIT_HORA}h UTC`,
  );
  // AMOSTRA DE MINUTO EM MINUTO, independente da verificação (que é de 5 em
  // 5). O dono pediu esse detalhe, e ele importa: a verificação a cada 5 min
  // não enxergaria um pico de 1 minuto, e é justamente o pico que se quer ver.
  const AMOSTRA_MS = 60_000;
  await coletarMetrica();
  const relogioMetricas = setInterval(() => {
    void coletarMetrica();
  }, AMOSTRA_MS);
  if (UMA_VEZ) clearInterval(relogioMetricas);

  do {
    try {
      await verificar();
      // Mantém o histórico do monitor em 90 dias (~130 mil amostras).
      await pool.query("DELETE FROM vps_metric WHERE at < NOW() - INTERVAL 90 DAY");
    } catch (e) {
      console.error("falha na verificação:", (e as Error).message);
    }
    if (UMA_VEZ) break;
    await sleep(INTERVALO_MIN * 60 * 1000);
  } while (true);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
