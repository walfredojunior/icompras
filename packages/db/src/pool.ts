import mariadb from 'mariadb';
import { dbConfig } from './env.js';

// Pool de conexões reutilizável pela aplicação (API, workers, web).
export const pool = mariadb.createPool({
  ...dbConfig,
  connectionLimit: 10,
  allowPublicKeyRetrieval: true,
  // Datas como string/Date nativa; decimais como número.
  decimalAsNumber: true,
  bigIntAsNumber: true,
});

export async function ping(): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
    return true;
  } finally {
    conn.release();
  }
}
