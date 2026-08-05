import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";
import { cpus } from "node:os";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Dados do Monitor VPS. As amostras são gravadas pelo guardião de minuto em
// minuto (apps/worker/src/metricas.ts); aqui só se lê e agrega.
export async function GET(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const horas = Math.min(168, Math.max(1, Number(new URL(req.url).searchParams.get("horas") ?? 24)));

  const [agora] = await pool.query(
    `SELECT at, cpu_pct, mem_pct, mem_usada_mb, mem_total_mb, swap_pct, swap_usada_mb, swap_total_mb, disco_pct, disco_usado_gb,
            disco_total_gb, carga1, carga5, carga15, rede_rx_kbs, rede_tx_kbs,
            TIMESTAMPDIFF(SECOND, at, NOW()) AS idadeSeg
       FROM vps_metric ORDER BY at DESC LIMIT 1`,
  );

  // Série do período. Agrupada de 10 em 10 minutos para o gráfico não virar
  // um borrão: 24h de amostra por minuto são 1.440 pontos para ~800 pixels.
  const serie = await pool.query(
    `SELECT DATE_FORMAT(at, '%Y-%m-%d %H:%i') AS quando,
            ROUND(AVG(cpu_pct), 1) cpu, ROUND(AVG(mem_pct), 1) mem,
            ROUND(AVG(carga1), 2) carga, ROUND(AVG(rede_rx_kbs)) rx, ROUND(AVG(rede_tx_kbs)) tx
       FROM vps_metric
      WHERE at > NOW() - INTERVAL ? HOUR
      GROUP BY FLOOR(UNIX_TIMESTAMP(at) / 600)
      ORDER BY MIN(at)`,
    [horas],
  );

  // HORÁRIOS DE PICO — a pergunta que o dono fez.
  //
  // Média E máximo por hora do dia: a média mostra o comportamento normal, o
  // máximo mostra se aquela hora já apertou. Sem o máximo, um pico de 15
  // minutos desaparece dentro da média da hora.
  const picos = await pool.query(
    `SELECT HOUR(at) hora,
            ROUND(AVG(cpu_pct), 1) cpuMedia, ROUND(MAX(cpu_pct), 1) cpuPico,
            ROUND(AVG(carga1), 2) cargaMedia, ROUND(MAX(carga1), 2) cargaPico,
            ROUND(AVG(mem_pct), 1) memMedia,
            COUNT(*) amostras
       FROM vps_metric
      WHERE at > NOW() - INTERVAL 7 DAY
      GROUP BY HOUR(at) ORDER BY hora`,
  );

  // O que o site estava fazendo naquelas horas. Pico de processador às 3 da
  // manhã não diz nada sozinho; junto das visitas, diz.
  const visitas = await pool.query(
    `SELECT hour hora, SUM(views) visitas FROM analytics_daily
      WHERE day > CURDATE() - INTERVAL 7 DAY GROUP BY hour ORDER BY hora`,
  );

  const num = (v: unknown) => (v == null ? null : Number(v));
  return NextResponse.json({
    nucleos: cpus().length || 1,
    agora: agora
      ? {
          at: agora.at ? new Date(agora.at).toISOString() : null,
          idadeSeg: num(agora.idadeSeg),
          cpu: num(agora.cpu_pct),
          mem: num(agora.mem_pct),
          memUsadaMb: num(agora.mem_usada_mb),
          memTotalMb: num(agora.mem_total_mb),
          swap: num(agora.swap_pct),
          swapUsadaMb: num(agora.swap_usada_mb),
          swapTotalMb: num(agora.swap_total_mb),
          disco: num(agora.disco_pct),
          discoUsadoGb: num(agora.disco_usado_gb),
          discoTotalGb: num(agora.disco_total_gb),
          carga1: num(agora.carga1),
          carga5: num(agora.carga5),
          carga15: num(agora.carga15),
          rx: num(agora.rede_rx_kbs),
          tx: num(agora.rede_tx_kbs),
        }
      : null,
    serie: serie.map((r: any) => ({
      quando: r.quando,
      cpu: num(r.cpu),
      mem: num(r.mem),
      carga: num(r.carga),
      rx: num(r.rx),
      tx: num(r.tx),
    })),
    picos: picos.map((r: any) => ({
      hora: Number(r.hora),
      cpuMedia: num(r.cpuMedia),
      cpuPico: num(r.cpuPico),
      cargaMedia: num(r.cargaMedia),
      cargaPico: num(r.cargaPico),
      memMedia: num(r.memMedia),
      amostras: Number(r.amostras),
    })),
    visitasPorHora: visitas.map((r: any) => ({ hora: Number(r.hora), visitas: Number(r.visitas) })),
  });
}
