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
  const coletor = await conferirColetor();
  // Só vale conferir robô por robô se o coletor não estiver parado de
  // propósito — senão o guardião religaria o que o dono desligou no painel.
  const robos =
    coletor.status === "parado-pelo-usuario"
      ? { status: "ok", detail: "parado pelo painel" }
      : await conferirRobos();
  const site = await conferirSite();
  const vps = await conferirLimites();
  await talvezAuditar();

  const problemas = [banco, laco, coletor, robos, site, vps].filter(
    (v) => v.status !== "ok" && v.status !== "parado-pelo-usuario",
  );
  const status = problemas.length ? problemas[0].status : coletor.status === "ok" ? "ok" : coletor.status;
  const detalhe =
    `coletor: ${coletor.detail} · robôs: ${robos.detail} · site: ${site.detail}` +
    ` · servidor: ${vps.detail} · banco: ${banco.detail}` +
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
