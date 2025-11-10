import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider } from '../interfaces';

/**
 * Configuration for Anthropic LLM Provider
 */
export interface AnthropicLLMConfig {
  apiKey: string;
  model: string;
  temperature?: number;
}

/**
 * Anthropic LLM Provider
 * 
 * Generates natural language responses using Anthropic's Claude models.
 * Supports Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Sonnet, and Claude 3 Haiku.
 * 
 * Note: Anthropic does not provide embedding models. Use OpenAI or DeepSeek for embeddings.
 */
export class AnthropicLLMProvider implements LLMProvider {
  public readonly provider = 'anthropic';
  public readonly model: string;
  
  private client: Anthropic;
  private defaultTemperature: number;
  
  /**
   * Known Claude model identifiers
   */
  private static readonly KNOWN_MODELS = [
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    // Add newer models as they become available
  ];
  
  constructor(config: AnthropicLLMConfig) {
    // Validation
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('Anthropic API key is required for LLM provider');
    }
    
    if (!config.model || config.model.trim() === '') {
      throw new Error('Anthropic LLM model is required');
    }
    
    this.model = config.model;
    this.defaultTemperature = config.temperature ?? 0.7;
    
    // Validate temperature (Anthropic uses 0-1 range)
    if (this.defaultTemperature < 0 || this.defaultTemperature > 1) {
      throw new Error(`Invalid temperature: ${this.defaultTemperature}. Anthropic models accept 0-1.`);
    }
    
    // Warn if model is not in known list (may be newer model)
    if (!AnthropicLLMProvider.KNOWN_MODELS.includes(this.model)) {
      console.warn(
        `Warning: Unknown Anthropic model '${this.model}'. ` +
        `Known models: ${AnthropicLLMProvider.KNOWN_MODELS.join(', ')}. ` +
        `This may work if it's a newer model.`
      );
    }
    
    // Initialize Anthropic client
    this.client = new Anthropic({ apiKey: config.apiKey });
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
    if (temp < 0 || temp > 1) {
      throw new Error(`Invalid temperature: ${temp}. Anthropic models accept 0-1.`);
    }
    
    // Format user message with context
    const userMessage = context
      ? `Context:\n${context}\n\nQuestion: ${prompt}\n\nAnswer based on the context above:`
      : prompt;
    
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096, // Reasonable default for responses
        system: systemMessage || 'You are a helpful assistant that answers questions based on the provided context.',
        temperature: temp,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });
      
      // Extract text from response
      const textContent = response.content.find(
        (block) => block.type === 'text'
      );
      
      if (!textContent || textContent.type !== 'text') {
        throw new Error('Anthropic returned no text content');
      }
      
      return textContent.text;
    } catch (error) {
      throw new Error(
        `Failed to generate Anthropic response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
