import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mariadb from 'mariadb';
import { dbConfig } from './env.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, '..', 'migrations');

async function main(): Promise<void> {
  const conn = await mariadb.createConnection({
    ...dbConfig,
    multipleStatements: true,
    allowPublicKeyRetrieval: true,
  });

  await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(255) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const rows: Array<{ version: string }> = await conn.query('SELECT version FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.version));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`= já aplicada: ${file}`);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`+ aplicando:  ${file}`);
    await conn.query(sql);
    await conn.query('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
    ran++;
  }

  console.log(ran === 0 ? 'Nada novo a aplicar.' : `${ran} migration(s) aplicada(s).`);
  await conn.end();
}

main().catch((err) => {
  console.error('Falha na migração:', err);
  process.exit(1);
});
