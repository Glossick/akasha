import OpenAI from 'openai';

interface EmbeddingConfig {
  apiKey: string;
  model?: string;
  embeddingModel?: string;
}

/**
 * EmbeddingService for generating embeddings and LLM responses
 */
export class EmbeddingService {
  private client: OpenAI;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    if (!config.apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'gpt-4',
      embeddingModel: config.embeddingModel || 'text-embedding-3-small',
    };
    this.client = new OpenAI({ apiKey: config.apiKey });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.config.embeddingModel!,
      input: text,
    });

    return response.data[0].embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.config.embeddingModel!,
      input: texts,
    });

    return response.data.map((item) => item.embedding);
  }

  async generateResponse(
    prompt: string,
    context: string,
    systemMessage?: string,
    temperature?: number
  ): Promise<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemMessage || 'You are a helpful assistant that answers questions based on the provided context.',
      },
      {
        role: 'user',
        content: context
          ? `Context:\n${context}\n\nQuestion: ${prompt}\n\nAnswer based on the context above:`
          : prompt,
      },
    ];

    const response = await this.client.chat.completions.create({
      model: this.config.model!,
      messages,
      temperature: temperature ?? 0.7,
    });

    return response.choices[0]?.message?.content || '';
  }
}
