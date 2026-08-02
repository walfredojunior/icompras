import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Carrega o .env da raiz do monorepo (apps/api/src -> raiz).
const here = dirname(fileURLToPath(import.meta.url));
config({ path: join(here, "..", "..", "..", ".env") });
