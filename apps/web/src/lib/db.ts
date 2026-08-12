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
    // ⚠ QUANTOS PEDIDOS O SITE CONSEGUE ATENDER AO MESMO TEMPO.
    //
    // Era **5**, e isso derrubou o desempenho em 12/08/2026: a home passou a
    // levar de 14 a 34 segundos. O diagnóstico demorou porque cada consulta,
    // medida sozinha, era rápida — destaques 89 ms, blocos 284 ms, quedas
    // 68 ms. O tempo não estava no banco: estava na FILA para entrar nele.
    //
    // Uma página da home faz seis ou sete consultas. Com 5 vagas para o site
    // inteiro, poucos visitantes simultâneos já formavam fila, e cada um
    // esperava a vez dos outros.
    //
    // 💡 O sintoma engana: "todas as consultas são rápidas" faz procurar em
    // todo lugar menos no limite de conexões. Quando a página está lenta e as
    // consultas não estão, **olhar o tamanho do pool antes de qualquer coisa**.
    //
    // 25 é folgado para o movimento de hoje (7.500 visitas/dia, pico às 18h) e
    // cabe no limite do MariaDB (151 no total, e os robôs já usam ~80).
    connectionLimit: Number(process.env.DB_POOL ?? 25),
    allowPublicKeyRetrieval: true,
    decimalAsNumber: true,
    bigIntAsNumber: true,
  }));
