// Camada de IA configurável. A aplicação sempre chama esta interface;
// qual provedor roda é decidido por variável de ambiente (AI_PROVIDER).

export interface CategorizeInput {
  name: string;
  description?: string;
  categoriesSlugs: string[];
}
export interface CategorizeResult {
  categorySlug: string | null;
  confidence: number;
}

export interface ExtractAttributesInput {
  name: string;
  description?: string;
}
export interface ExtractedAttribute {
  key: string; // color, storage, size...
  valueLabel: string; // "Preto"
  valueSlug: string; // "preto"
}

export interface AiProvider {
  readonly name: string;
  /** Gera embeddings (para agrupamento/similaridade de produtos). */
  embed(texts: string[]): Promise<number[][]>;
  /** Escolhe a melhor categoria dentre as fornecidas. */
  categorize(input: CategorizeInput): Promise<CategorizeResult>;
  /** Extrai atributos estruturados (cor, tamanho...) de um texto de produto. */
  extractAttributes(input: ExtractAttributesInput): Promise<ExtractedAttribute[]>;
}

/** Stub — implementação real entra na Fase 2 (Claude via SDK Anthropic). */
class ClaudeProvider implements AiProvider {
  readonly name = 'claude';
  async embed(): Promise<number[][]> {
    throw new Error('ClaudeProvider.embed: a implementar na Fase 2 (usar provedor de embeddings, ex.: Voyage).');
  }
  async categorize(): Promise<CategorizeResult> {
    throw new Error('ClaudeProvider.categorize: a implementar na Fase 2.');
  }
  async extractAttributes(): Promise<ExtractedAttribute[]> {
    throw new Error('ClaudeProvider.extractAttributes: a implementar na Fase 2.');
  }
}

const REGISTRY: Record<string, () => AiProvider> = {
  claude: () => new ClaudeProvider(),
  // openai: () => new OpenAiProvider(),  // futuro
};

export function getAiProvider(): AiProvider {
  const key = process.env.AI_PROVIDER ?? 'claude';
  const factory = REGISTRY[key];
  if (!factory) throw new Error(`AI_PROVIDER desconhecido: "${key}". Opções: ${Object.keys(REGISTRY).join(', ')}`);
  return factory();
}
