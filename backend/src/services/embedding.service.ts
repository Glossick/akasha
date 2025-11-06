import OpenAI from 'openai';
import { openaiConfig } from '../config/openai';

export class EmbeddingService {
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || openaiConfig.apiKey;
    if (!key) {
      throw new Error('OPENAI_API_KEY is required. Set it in environment variables.');
    }
    this.client = new OpenAI({ apiKey: key });
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: openaiConfig.embeddingModel,
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: openaiConfig.embeddingModel,
      input: texts,
    });

    return response.data.map((item) => item.embedding);
  }

  /**
   * Generate LLM response with context
   */
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
      model: openaiConfig.model,
      messages,
      temperature: temperature ?? 0.7,
    });

    return response.choices[0]?.message?.content || '';
  }
}

