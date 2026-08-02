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
    //   pm2 delete icompras-crawler-1 icompras-crawler-2 icompras-crawler-3
    //   e troque CRAWL_WORKERS para "1" no icompras-crawler-0.
    ...[0, 1, 2, 3].map((i) => ({
      name: `icompras-crawler-${i}`,
      cwd: "/opt/icompras/app",
      script: "npm",
      args: "run crawl -w @icompras/worker",
      env: {
        NODE_ENV: "production",
        CRAWL_MONITOR: "true",
        CRAWL_WORKERS: "4",
        CRAWL_WORKER_ID: String(i),
        CRAWL_RPS: "2",
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
