import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Carrega o .env da raiz do monorepo (../../../ a partir de packages/db/src)
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, '..', '..', '..', '.env') });

export const dbConfig = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3307),
  user: process.env.DB_USER ?? 'icompras_app',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'icompras',
};
