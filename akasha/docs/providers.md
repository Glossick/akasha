# Provider Configuration

Akasha supports configurable embedding and LLM providers, allowing you to choose the best models for your use case.

## Overview

Akasha separates two distinct capabilities:

1. **Embedding Provider**: Generates vector embeddings for semantic search
2. **LLM Provider**: Generates natural language for entity extraction and query answering

These are independent - you can mix and match providers (e.g., OpenAI embeddings with Anthropic LLM).

## Supported Providers

### Embedding Providers

| Provider | Models | Dimensions | Notes |
|----------|--------|------------|-------|
| **OpenAI** | `text-embedding-3-small` | 1536 (default) | Recommended for most use cases |
| | `text-embedding-3-large` | 3072 (default) | Higher quality, larger vectors |
| | `text-embedding-ada-002` | 1536 | Legacy model |

### LLM Providers

| Provider | Recommended Models | Notes |
|----------|-------------------|-------|
| **OpenAI** | `gpt-4`, `gpt-4-turbo`, `gpt-4o` | Full-featured, well-tested |
| **Anthropic** | `claude-3-5-sonnet-20241022` | Excellent for entity extraction |
| | `claude-3-opus-20240229` | Highest quality |
| | `claude-3-sonnet-20240229` | Balanced |
| | `claude-3-haiku-20240307` | Fast, cost-effective |
| **DeepSeek** | `deepseek-chat` | Cost-effective, OpenAI-compatible |
| | `deepseek-reasoner` | Thinking mode (enhanced reasoning) |

## Configuration

### Basic Configuration (OpenAI Only)

```typescript
import { akasha } from '@glossick/akasha';

const kg = akasha({
  neo4j: {
    uri: process.env.NEO4J_URI!,
    user: process.env.NEO4J_USER!,
    password: process.env.NEO4J_PASSWORD!,
  },
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'text-embedding-3-small',
      },
    },
    llm: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'gpt-4',
      },
    },
  },
});
```

### Multi-Provider Configuration (OpenAI + Anthropic)

```typescript
const kg = akasha({
  neo4j: {
    uri: process.env.NEO4J_URI!,
    user: process.env.NEO4J_USER!,
    password: process.env.NEO4J_PASSWORD!,
  },
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'text-embedding-3-small',
      },
    },
    llm: {
      type: 'anthropic',
      config: {
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: 'claude-3-5-sonnet-20241022',
      },
    },
  },
});
```

### Using DeepSeek LLM

Cost-effective alternative using DeepSeek's OpenAI-compatible API:

```typescript
const kg = akasha({
  neo4j: {
    uri: process.env.NEO4J_URI!,
    user: process.env.NEO4J_USER!,
    password: process.env.NEO4J_PASSWORD!,
  },
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'text-embedding-3-small',
      },
    },
    llm: {
      type: 'deepseek',
      config: {
        apiKey: process.env.DEEPSEEK_API_KEY!,
        model: 'deepseek-chat', // or 'deepseek-reasoner' for thinking mode
      },
    },
  },
});
```

### Custom Embedding Dimensions

OpenAI's `text-embedding-3-*` models support custom dimensionality:

```typescript
providers: {
  embedding: {
    type: 'openai',
    config: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'text-embedding-3-small',
      dimensions: 512, // Smaller vectors = faster queries, less storage
    },
  },
  llm: { /* ... */ },
}
```

**Note**: Your Neo4j vector index must match the embedding dimensions. Lower dimensions = faster performance but potentially lower quality.

### Custom Temperature

Control generation randomness:

```typescript
providers: {
  embedding: { /* ... */ },
  llm: {
    type: 'anthropic',
    config: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.3, // Lower = more deterministic (0.0-1.0 for Anthropic)
    },
  },
}
```

**Temperature ranges:**
- OpenAI: 0.0 - 2.0 (default: 0.7)
- Anthropic: 0.0 - 1.0 (default: 0.7)

## Provider Combinations

### Recommended Combinations

**Production (High Quality)**:
- Embedding: `text-embedding-3-large` (OpenAI)
- LLM: `claude-3-5-sonnet-20241022` (Anthropic)

**Cost-Effective**:
- Embedding: `text-embedding-3-small` (OpenAI, 512 dims)
- LLM: `deepseek-chat` (DeepSeek)

**Balanced**:
- Embedding: `text-embedding-3-small` (OpenAI, default 1536 dims)
- LLM: `claude-3-5-sonnet-20241022` (Anthropic)

**All OpenAI**:
- Embedding: `text-embedding-3-small` (OpenAI)
- LLM: `gpt-4` (OpenAI)

## Environment Variables

Set up your API keys:

```bash
# Required for embeddings
export OPENAI_API_KEY=sk-...

# Optional - for using Anthropic LLM
export ANTHROPIC_API_KEY=sk-ant-...

# Optional - for using DeepSeek LLM
export DEEPSEEK_API_KEY=sk-...

# Neo4j
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=your-password
```

## Advanced: Custom Provider Injection

For maximum flexibility, you can inject custom provider implementations:

```typescript
import type { EmbeddingProvider, LLMProvider } from '@glossick/akasha';

const customEmbeddingProvider: EmbeddingProvider = {
  provider: 'custom',
  model: 'my-model',
  dimensions: 1024,
  async generateEmbedding(text: string): Promise<number[]> {
    // Your custom implementation
    return new Array(1024).fill(0);
  },
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map(() => new Array(1024).fill(0));
  },
};

const kg = new Akasha(
  config,
  undefined, // neo4jService
  customEmbeddingProvider,
  customLLMProvider
);
```

## Provider-Specific Notes

### OpenAI

- **Embeddings**: Industry standard, well-optimized
- **LLM**: Excellent for general-purpose extraction
- **Temperature**: Supports full 0-2 range
- **Dimensions**: `text-embedding-3-*` models support custom dimensionality

### Anthropic

- **Embeddings**: Not available (use OpenAI or custom)
- **LLM**: Excellent for complex entity extraction and reasoning
- **Temperature**: Limited to 0-1 range
- **Max Tokens**: Automatically set to 4096 for responses

### DeepSeek

- **Embeddings**: Not available (use OpenAI or custom)
- **LLM**: Cost-effective alternative to OpenAI, uses OpenAI-compatible API
- **Temperature**: 0-2 range (same as OpenAI)
- **Models**: `deepseek-chat` (non-thinking), `deepseek-reasoner` (thinking mode)
- **API Format**: OpenAI-compatible (uses OpenAI SDK with custom base URL)
- **Reference**: [DeepSeek API Documentation](https://api-docs.deepseek.com/)

## Validation

Providers self-validate on construction:

```typescript
// This will throw immediately with clear error message
const kg = akasha({
  neo4j: { /* ... */ },
  providers: {
    embedding: {
      type: 'openai',
      config: {
        apiKey: '', // ❌ Empty API key
        model: 'text-embedding-3-small',
      },
    },
    llm: { /* ... */ },
  },
});
// Error: OpenAI API key is required for embedding provider
```

## Extensibility

The provider system is designed for extensibility. You can:
- **Add Custom Providers**: Implement `EmbeddingProvider` or `LLMProvider` interface
- **Future Providers**: Cohere embeddings, local models via Ollama, etc.
- **Provider Injection**: Pass custom provider instances to Akasha constructor

### Adding a Custom Provider

```typescript
import type { LLMProvider } from '@glossick/akasha';

class MyCustomLLMProvider implements LLMProvider {
  readonly provider = 'custom';
  readonly model = 'my-model';
  
  async generateResponse(prompt, context, systemMessage?, temperature?): Promise<string> {
    // Your implementation
    return 'Custom response';
  }
}

const customProvider = new MyCustomLLMProvider();
const kg = new Akasha(config, undefined, embeddingProvider, customProvider);
```

---

**Next**: See [Getting Started](./getting-started.md) for complete setup guide, or [API Reference](./api-reference.md) for detailed configuration options.

