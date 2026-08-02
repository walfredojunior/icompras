import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Liga/desliga o crawler. "start" dispara o processo; "stop" pede parada cooperativa.
export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }

  const { action } = await req.json().catch(() => ({}) as any);

  const rows = await pool.query(
    "SELECT state, TIMESTAMPDIFF(SECOND, heartbeat_at, NOW()) AS age FROM scrape_control WHERE id = 1",
  );
  const c = rows[0] ?? {};
  const running = c.state && c.state !== "idle" && c.age != null && Number(c.age) < 30;

  if (action === "stop") {
    await pool.query(
      "UPDATE scrape_control SET stop_requested = 1, state = 'stopping', message = 'parada solicitada…' WHERE id = 1",
    );
    return NextResponse.json({ ok: true, state: "stopping" });
  }

  if (action === "start") {
    if (running) return NextResponse.json({ ok: true, already: true, state: c.state });

    // Marca "running" já para a interface reagir na hora (o processo assume em seguida).
    await pool.query(
      `INSERT INTO scrape_control (id, state, stop_requested, message, started_at, heartbeat_at)
       VALUES (1, 'running', 0, 'iniciando…', NOW(), NOW())
       ON DUPLICATE KEY UPDATE state = 'running', stop_requested = 0, message = 'iniciando…',
         started_at = NOW(), heartbeat_at = NOW()`,
    );

    const cwd = process.cwd();
    const repoRoot = cwd.replace(/[\\/]apps[\\/]web$/, "");
    const logPath = path.join(repoRoot, "apps", "worker", "crawl-web.log");
    let out: number | "ignore" = "ignore";
    try {
      out = fs.openSync(logPath, "a");
    } catch {
      out = "ignore";
    }

    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(`${npmCmd} run crawl -w @icompras/worker`, {
      cwd: repoRoot,
      env: { ...process.env, CRAWL_MONITOR: "true" },
      detached: true,
      stdio: ["ignore", out, out],
      windowsHide: true,
      shell: true,
    });
    child.unref();

    return NextResponse.json({ ok: true, started: true });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
