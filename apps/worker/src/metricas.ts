import { readFile, statfs } from "node:fs/promises";
import { loadavg, cpus } from "node:os";
import { pool } from "@icompras/db";

// MONITOR DA VPS — processador, memória, disco, carga e rede.
//
// Tudo sai de arquivos que o próprio Linux já mantém (/proc). Nenhuma
// biblioteca, nenhum serviço externo, nenhum agente instalado.
//
// ⚠ SÓ FUNCIONA PORQUE ISTO RODA NA PRÓPRIA MÁQUINA que queremos medir. Se um
// dia o site ou o guardião saírem da VPS, este módulo mede a máquina errada e
// precisa ser refeito de outro jeito.
//
// Processador e rede são CONTADORES ACUMULADOS desde que a máquina ligou — o
// valor cru não diz nada sozinho. O que vale é a diferença entre duas
// amostras, por isso guardamos a leitura anterior em memória.

interface LeituraCpu {
  total: number;
  ocioso: number;
}
interface LeituraRede {
  rx: number;
  tx: number;
  em: number;
}

let cpuAnterior: LeituraCpu | null = null;
let redeAnterior: LeituraRede | null = null;

async function lerCpu(): Promise<LeituraCpu | null> {
  try {
    const txt = await readFile("/proc/stat", "utf8");
    const linha = txt.split("\n").find((l) => l.startsWith("cpu "));
    if (!linha) return null;
    const n = linha.trim().split(/\s+/).slice(1).map(Number);
    // Campos: user nice system idle iowait irq softirq steal ...
    const total = n.reduce((a, b) => a + b, 0);
    const ocioso = (n[3] ?? 0) + (n[4] ?? 0); // idle + iowait
    return { total, ocioso };
  } catch {
    return null;
  }
}

async function lerMemoria(): Promise<{
  pct: number;
  usadaMb: number;
  totalMb: number;
  swapPct: number | null;
  swapUsadaMb: number | null;
  swapTotalMb: number | null;
} | null> {
  try {
    const txt = await readFile("/proc/meminfo", "utf8");
    const kb = (chave: string) => {
      const m = new RegExp(`^${chave}:\\s+(\\d+)`, "m").exec(txt);
      return m ? Number(m[1]) : null;
    };
    const total = kb("MemTotal");
    // MemAvailable é o número honesto: conta o cache que o sistema devolveria
    // sob pressão. "free" sozinho assusta à toa.
    const disponivel = kb("MemAvailable");
    if (!total || disponivel == null) return null;
    const usada = total - disponivel;
    // Swap: enquanto estiver em zero, sobra folga. Quando começa a ser usada,
    // é o aviso de que a máquina entrou no limite — e chega ANTES de algo
    // morrer, que é o que interessa.
    const swapTotal = kb("SwapTotal");
    const swapLivre = kb("SwapFree");
    const temSwap = swapTotal != null && swapTotal > 0 && swapLivre != null;
    const swapUsada = temSwap ? swapTotal - swapLivre : null;
    return {
      pct: Math.round((usada / total) * 10000) / 100,
      usadaMb: Math.round(usada / 1024),
      totalMb: Math.round(total / 1024),
      swapPct: temSwap ? Math.round((swapUsada! / swapTotal!) * 10000) / 100 : null,
      swapUsadaMb: temSwap ? Math.round(swapUsada! / 1024) : null,
      swapTotalMb: temSwap ? Math.round(swapTotal! / 1024) : null,
    };
  } catch {
    return null;
  }
}

async function lerDisco(): Promise<{ pct: number; usadoGb: number; totalGb: number } | null> {
  try {
    const s = await statfs("/");
    const total = Number(s.blocks) * Number(s.bsize);
    // `bavail` (livre para usuário comum) e não `bfree`: o Linux reserva uma
    // fatia para o root, e usar bfree faz o disco parecer mais folgado do que
    // está na prática.
    const livre = Number(s.bavail) * Number(s.bsize);
    const usado = total - livre;
    const gb = (b: number) => Math.round((b / 1024 ** 3) * 100) / 100;
    return { pct: Math.round((usado / total) * 10000) / 100, usadoGb: gb(usado), totalGb: gb(total) };
  } catch {
    return null;
  }
}

async function lerRede(): Promise<LeituraRede | null> {
  try {
    const txt = await readFile("/proc/net/dev", "utf8");
    let rx = 0;
    let tx = 0;
    for (const linha of txt.split("\n").slice(2)) {
      const [nome, resto] = linha.split(":");
      if (!resto) continue;
      // `lo` é tráfego da máquina consigo mesma (site ↔ banco ↔ busca) e
      // inflaria o número sem dizer nada sobre a internet.
      if (nome.trim() === "lo") continue;
      const c = resto.trim().split(/\s+/).map(Number);
      rx += c[0] ?? 0;
      tx += c[8] ?? 0;
    }
    return { rx, tx, em: Date.now() };
  } catch {
    return null;
  }
}

/** Coleta uma amostra e grava. Nunca lança: medição não pode derrubar nada. */
export async function coletarMetrica(): Promise<void> {
  try {
    const [cpu, mem, disco, rede] = await Promise.all([lerCpu(), lerMemoria(), lerDisco(), lerRede()]);

    let cpuPct: number | null = null;
    if (cpu && cpuAnterior) {
      const dTotal = cpu.total - cpuAnterior.total;
      const dOcioso = cpu.ocioso - cpuAnterior.ocioso;
      if (dTotal > 0) cpuPct = Math.round((1 - dOcioso / dTotal) * 10000) / 100;
    }
    if (cpu) cpuAnterior = cpu;

    let rxKbs: number | null = null;
    let txKbs: number | null = null;
    if (rede && redeAnterior) {
      const seg = (rede.em - redeAnterior.em) / 1000;
      if (seg > 0) {
        rxKbs = Math.max(0, Math.round((rede.rx - redeAnterior.rx) / 1024 / seg));
        txKbs = Math.max(0, Math.round((rede.tx - redeAnterior.tx) / 1024 / seg));
      }
    }
    if (rede) redeAnterior = rede;

    const [c1, c5, c15] = loadavg();

    await pool.query(
      `INSERT INTO vps_metric
         (at, cpu_pct, mem_pct, mem_usada_mb, mem_total_mb,
          swap_pct, swap_usada_mb, swap_total_mb,
          disco_pct, disco_usado_gb, disco_total_gb, carga1, carga5, carga15, rede_rx_kbs, rede_tx_kbs)
       VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE cpu_pct = VALUES(cpu_pct)`,
      [
        cpuPct,
        mem?.pct ?? null,
        mem?.usadaMb ?? null,
        mem?.totalMb ?? null,
        mem?.swapPct ?? null,
        mem?.swapUsadaMb ?? null,
        mem?.swapTotalMb ?? null,
        disco?.pct ?? null,
        disco?.usadoGb ?? null,
        disco?.totalGb ?? null,
        c1 ?? null,
        c5 ?? null,
        c15 ?? null,
        rxKbs,
        txKbs,
      ],
    );
  } catch {
    /* medição nunca derruba o guardião */
  }
}

/** Quantos núcleos a máquina tem — é o que dá sentido ao número da carga. */
export function nucleos(): number {
  return cpus().length || 1;
}

/**
 * Avisa quando aperta. Um gráfico bonito não acorda ninguém: o ganho real é o
 * guardião registrar (e o painel mostrar) que passou do limite.
 */
export async function conferirLimites(): Promise<{ status: string; detail: string }> {
  const [m] = await pool.query(
    "SELECT mem_pct, swap_pct, disco_pct, carga1 FROM vps_metric ORDER BY at DESC LIMIT 1",
  );
  if (!m) return { status: "ok", detail: "sem amostra ainda" };
  const avisos: string[] = [];
  const mem = Number(m.mem_pct ?? 0);
  const disco = Number(m.disco_pct ?? 0);
  const carga = Number(m.carga1 ?? 0);
  // Memória é o limite mais perigoso: encostando no teto, o Linux começa a
  // matar processos — e os primeiros candidatos são justamente o navegador dos
  // robôs e o banco.
  if (mem >= 92) avisos.push(`memória em ${mem}%`);
  // Swap sendo usada de verdade = a memória já estourou e o sistema está
  // recorrendo ao disco. É o aviso mais antecipado que existe aqui.
  const swap = Number(m.swap_pct ?? 0);
  if (swap >= 20) avisos.push(`swap em ${swap}% (memória no limite)`);
  if (disco >= 85) avisos.push(`disco em ${disco}%`);
  if (carga >= nucleos() * 4) avisos.push(`carga em ${carga} para ${nucleos()} núcleos`);
  return avisos.length
    ? { status: "apertado", detail: avisos.join(" · ") }
    : { status: "ok", detail: `memória ${mem}% · disco ${disco}% · carga ${carga}` };
}
