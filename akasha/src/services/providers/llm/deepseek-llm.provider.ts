import OpenAI from 'openai';
import type { LLMProvider } from '../interfaces';

/**
 * Configuration for DeepSeek LLM Provider
 */
export interface DeepSeekLLMConfig {
  apiKey: string;
  model: string;
  temperature?: number;
}

/**
 * DeepSeek LLM Provider
 * 
 * Generates natural language responses using DeepSeek's language models.
 * Uses OpenAI-compatible API format with custom base URL.
 * 
 * Supported models:
 * - deepseek-chat (non-thinking mode of DeepSeek-V3.2-Exp)
 * - deepseek-reasoner (thinking mode of DeepSeek-V3.2-Exp)
 * 
 * Note: DeepSeek does not currently provide embedding models.
 * Use OpenAI for embeddings when using DeepSeek LLM.
 * 
 * Reference: https://api-docs.deepseek.com/
 */
export class DeepSeekLLMProvider implements LLMProvider {
  public readonly provider = 'deepseek';
  public readonly model: string;
  
  private client: OpenAI;
  private defaultTemperature: number;
  
  /**
   * Known DeepSeek model identifiers
   */
  private static readonly KNOWN_MODELS = [
    'deepseek-chat',
    'deepseek-reasoner',
  ];
  
  /**
   * DeepSeek API base URL (OpenAI-compatible)
   */
  private static readonly BASE_URL = 'https://api.deepseek.com';
  
  constructor(config: DeepSeekLLMConfig) {
    // Validation
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('DeepSeek API key is required for LLM provider');
    }
    
    if (!config.model || config.model.trim() === '') {
      throw new Error('DeepSeek LLM model is required');
    }
    
    this.model = config.model;
    this.defaultTemperature = config.temperature ?? 0.7;
    
    // Validate temperature (DeepSeek uses same range as OpenAI: 0-2)
    if (this.defaultTemperature < 0 || this.defaultTemperature > 2) {
      throw new Error(`Invalid temperature: ${this.defaultTemperature}. DeepSeek models accept 0-2.`);
    }
    
    // Warn if model is not in known list (may be newer model)
    if (!DeepSeekLLMProvider.KNOWN_MODELS.includes(this.model)) {
      console.warn(
        `Warning: Unknown DeepSeek model '${this.model}'. ` +
        `Known models: ${DeepSeekLLMProvider.KNOWN_MODELS.join(', ')}. ` +
        `This may work if it's a newer model.`
      );
    }
    
    // Initialize OpenAI client with DeepSeek base URL
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: DeepSeekLLMProvider.BASE_URL,
    });
  }
  
  async generateResponse(
    prompt: string,
    context: string,
    systemMessage?: string,
    temperature?: number
  ): Promise<string> {
    if (!prompt || prompt.trim() === '') {
      throw new Error('Prompt cannot be empty for LLM generation');
    }
    
    const temp = temperature ?? this.defaultTemperature;
    
    // Validate temperature
    if (temp < 0 || temp > 2) {
      throw new Error(`Invalid temperature: ${temp}. DeepSeek models accept 0-2.`);
    }
    
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
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: temp,
      });
      
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('DeepSeek returned empty response');
      }
      
      return content;
    } catch (error) {
      throw new Error(
        `Failed to generate DeepSeek response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
