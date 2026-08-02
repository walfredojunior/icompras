import { hashEmbed } from "./local.js";

export { hashEmbed };

// A dimensão precisa casar com a coluna VECTOR(1024) do banco.
export const EMBEDDING_DIM = 1024;

export interface EmbeddingProvider {
  readonly name: string;
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

/** Provedor local (padrão) — sem chave, offline, grátis. */
class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local";
  readonly dim = EMBEDDING_DIM;
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => hashEmbed(t, this.dim));
  }
}

/** Provedores em nuvem — precisam de EMBEDDING_API_KEY e implementação futura. */
class CloudEmbeddingStub implements EmbeddingProvider {
  readonly dim = EMBEDDING_DIM;
  constructor(readonly name: string) {}
  async embed(): Promise<number[][]> {
    throw new Error(
      `Provedor de embeddings "${this.name}" requer EMBEDDING_API_KEY e implementação (atenção à dimensão do vetor).`,
    );
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  const key = process.env.EMBEDDING_PROVIDER ?? "local";
  if (key === "local") return new LocalEmbeddingProvider();
  return new CloudEmbeddingStub(key); // voyage | openai
}
