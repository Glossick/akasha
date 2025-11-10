import OpenAI from 'openai';
import type { LLMProvider } from '../interfaces';

/**
 * Configuration for OpenAI LLM Provider
 */
export interface OpenAILLMConfig {
  apiKey: string;
  model: string;
  temperature?: number;
}

/**
 * OpenAI LLM Provider
 * 
 * Generates natural language responses using OpenAI's language models.
 * Supports GPT-4, GPT-4 Turbo, and GPT-4o models.
 */
export class OpenAILLMProvider implements LLMProvider {
  public readonly provider = 'openai';
  public readonly model: string;
  
  private client: OpenAI;
  private defaultTemperature: number;
  
  constructor(config: OpenAILLMConfig) {
    // Validation
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('OpenAI API key is required for LLM provider');
    }
    
    if (!config.model || config.model.trim() === '') {
      throw new Error('OpenAI LLM model is required');
    }
    
    this.model = config.model;
    this.defaultTemperature = config.temperature ?? 0.7;
    
    // Validate temperature
    if (this.defaultTemperature < 0 || this.defaultTemperature > 2) {
      throw new Error(`Invalid temperature: ${this.defaultTemperature}. Must be between 0 and 2.`);
    }
    
    // Initialize OpenAI client
    this.client = new OpenAI({ apiKey: config.apiKey });
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
      throw new Error(`Invalid temperature: ${temp}. Must be between 0 and 2.`);
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
        throw new Error('OpenAI returned empty response');
      }
      
      return content;
    } catch (error) {
      throw new Error(
        `Failed to generate OpenAI response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
