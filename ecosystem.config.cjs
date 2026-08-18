// Serviços do iCompras no servidor (PM2). Sobem sozinhos no boot.
//   pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "icompras-web",
      cwd: "/opt/icompras/app",
      script: "npm",
      args: "run start -w @icompras/web",
      env: { NODE_ENV: "production", PORT: "3000" },
    },
    {
      name: "icompras-api",
      cwd: "/opt/icompras/app",
      script: "npm",
      args: "run start -w @icompras/api",
      env: { NODE_ENV: "production" },
    },
    {
      name: "icompras-worker",
      cwd: "/opt/icompras/app",
      script: "npm",
      args: "run start -w @icompras/worker",
      env: { NODE_ENV: "production" },
    },
    // COLETOR — 4 robôs em paralelo (v1.1).
    //
    // Com um robô só, a volta completa passou a levar ~12 dias depois que o
    // catálogo quadruplicou. E a máquina estava com carga 0,12: o limite não
    // era o servidor, era a pausa de educação entre um pedido e outro.
    //
    // Os quatro DIVIDEM um teto de 2 pedidos por segundo (CRAWL_RPS), então
    // acrescentar robô NÃO aumenta a pressão sobre a fonte — cada um espera
    // 4/2 = 2 segundos entre páginas. Eles puxam categorias de uma fila
    // compartilhada (crawl_category) e o robô 0 é o chefe: controla a volta e
    // roda as varreduras do fim (marcas, mapa do site, fila, resumo do dia).
    //
    // PARA VOLTAR AO ROBÔ ÚNICO:
    //   pm2 delete icompras-crawler-1 … icompras-crawler-5
    //   e troque CRAWL_WORKERS para "1" no icompras-crawler-0.
    //
    // PAPÉIS (05/08/2026, ideia do dono): os robôs deixaram de ser iguais.
    //   0, 1, 4 e 5 → volta normal pelas categorias (o 0 é o chefe)
    //   2           → só os produtos QUENTES, em ciclo contínuo (~1h por volta)
    //   3           → só descoberta de produtos NOVOS (mapa do site e marcas)
    //
    // Isso NÃO aumenta a pressão sobre a fonte: os quatro seguem dividindo o
    // mesmo teto de 2 pedidos por segundo. É redistribuir, não acelerar.
    //
    // Para voltar a ter robôs iguais, basta apagar a linha CRAWL_PAPEL.
    //
    // ====================================================================
    // 4 → 6 ROBÔS (18/08/2026) — ideia do dono, e o número que a justificou
    // ====================================================================
    // Ele perguntou: *"tem mais recursos da máquina, e se colocar mais robôs?"*.
    // Antes de mexer, medi:
    //
    //     teto que nós mesmos impomos:  2,00 páginas/s
    //     o que estávamos usando:       0,75 páginas/s  (64.815 em 24h)
    //
    // **Estávamos usando 37% da nossa própria permissão.** Cada página levava
    // ~5,3s, dos quais só 2s eram a pausa obrigatória; os outros 3,3s eram o
    // robô PARADO, esperando a fonte responder ou o navegador desenhar. Robô
    // que espera não gasta nada — é exatamente o caso em que mais robôs rendem.
    //
    // ⚠ E continua sem aumentar a pressão sobre a fonte: a pausa de cada um é
    // `robôs ÷ ritmo`, então com 6 cada um espera 3s e o total segue em 2/s.
    // O que NÃO se pode mexer sem pensar muito é o `CRAWL_RPS` — esse sim
    // aperta a fonte, e é a classe de risco que rendeu os 403 e obrigou a
    // montar o servidor de Dallas.
    //
    // Os dois novos entram como "normal", que é onde está a fila do mapa: são
    // 4 robôs na volta pelo catálogo em vez de 2. Esperado: ~65 mil → ~95 mil
    // páginas/dia, e a volta completa caindo de ~5,5 para ~3,5 dias.
    // ⚠ MEDIR UM DIA INTEIRO antes de pensar em mais: o próximo gargalo pode
    // deixar de ser a espera e passar a ser o processador dos navegadores.
    ...[0, 1, 2, 3, 4, 5].map((i) => ({
      name: `icompras-crawler-${i}`,
      cwd: "/opt/icompras/app",
      script: "npm",
      args: "run crawl -w @icompras/worker",
      env: {
        NODE_ENV: "production",
        CRAWL_MONITOR: "true",
        CRAWL_WORKERS: "6",
        CRAWL_WORKER_ID: String(i),
        CRAWL_RPS: "2",
        CRAWL_PAPEL: i === 2 ? "quentes" : i === 3 ? "novos" : "normal",
      },
      autorestart: true,
      // stop_exit_codes: [0] faz o PM2 respeitar a parada pelo painel admin
      // (saída limpa) em vez de religar por conta própria.
      stop_exit_codes: [0],
      max_restarts: 30,
      // Escalonado: quatro robôs subindo no mesmo segundo dariam uma rajada
      // de pedidos logo na largada — justo o que o teto existe para evitar.
      restart_delay: 8000 + i * 4000,
    })),
    {
      // Guardião: confere o coletor e o site a cada poucos minutos e religa
      // o que travar. Respeita a parada feita de propósito pelo painel.
      name: "icompras-guardiao",
      cwd: "/opt/icompras/app",
      script: "npm",
      args: "run guardiao -w @icompras/worker",
      env: { NODE_ENV: "production", GUARD_INTERVAL_MIN: "5" },
      autorestart: true,
      restart_delay: 15000,
    },
  ],
};
