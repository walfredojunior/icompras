import mariadb, { type Pool } from "mariadb";

// Pool único reaproveitado entre recompilações do Next (HMR) em dev.
const g = globalThis as unknown as { _icomprasPool?: Pool };

export const pool =
  g._icomprasPool ??
  (g._icomprasPool = mariadb.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.DB_USER ?? "icompras_app",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? "icompras",
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
    decimalAsNumber: true,
    bigIntAsNumber: true,
  }));
