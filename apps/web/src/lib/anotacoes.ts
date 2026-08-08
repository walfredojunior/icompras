import { pool } from "./db";

// As anotações do dono — servidores, acessos, planos, o que ele quiser lembrar.
//
// ⚠ Este arquivo NÃO contém nenhum dado: só o caminho até o banco. As senhas
// ficam nas linhas da tabela `anotacao`, que nunca sai do servidor. Ver o
// porquê na migration 045.

export interface Anotacao {
  id: number;
  titulo: string;
  conteudo: string;
  ordem: number;
  atualizadoEm: string;
}

export async function listarAnotacoes(): Promise<Anotacao[]> {
  const linhas = await pool.query(
    "SELECT id, titulo, conteudo, ordem, updated_at FROM anotacao ORDER BY ordem, id",
  );
  return linhas.map((r: { id: number; titulo: string; conteudo: string; ordem: number; updated_at: Date }) => ({
    id: Number(r.id),
    titulo: r.titulo,
    conteudo: r.conteudo,
    ordem: Number(r.ordem),
    atualizadoEm: new Date(r.updated_at).toISOString(),
  }));
}

export async function salvarAnotacao(a: {
  id?: number;
  titulo: string;
  conteudo: string;
  ordem?: number;
}): Promise<number> {
  const titulo = a.titulo.trim().slice(0, 120) || "Sem título";
  const conteudo = a.conteudo.slice(0, 200000);
  if (a.id) {
    await pool.query("UPDATE anotacao SET titulo = ?, conteudo = ?, ordem = ? WHERE id = ?", [
      titulo,
      conteudo,
      a.ordem ?? 0,
      a.id,
    ]);
    return a.id;
  }
  // Nova anotação entra no fim da lista.
  const [ultimo] = await pool.query("SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima FROM anotacao");
  const res = await pool.query("INSERT INTO anotacao (titulo, conteudo, ordem) VALUES (?, ?, ?)", [
    titulo,
    conteudo,
    a.ordem ?? Number(ultimo?.proxima ?? 1),
  ]);
  return Number(res.insertId);
}

export async function apagarAnotacao(id: number): Promise<void> {
  await pool.query("DELETE FROM anotacao WHERE id = ?", [id]);
}
