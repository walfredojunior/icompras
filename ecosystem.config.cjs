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
    {
      // Coletor em modo monitor: roda em ciclos, sem parar.
      // stop_exit_codes: [0] faz o PM2 respeitar a parada pelo painel admin
      // (saída limpa) em vez de religar por conta própria.
      name: "icompras-crawler",
      cwd: "/opt/icompras/app",
      script: "npm",
      args: "run crawl -w @icompras/worker",
      env: { NODE_ENV: "production", CRAWL_MONITOR: "true" },
      autorestart: true,
      stop_exit_codes: [0],
      max_restarts: 30,
      restart_delay: 8000,
    },
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
