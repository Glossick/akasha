import { useState } from 'react';
import type { GraphRAGQuery } from '../api.ts';

interface QueryFormProps {
  onSubmit: (query: GraphRAGQuery) => void;
  isLoading: boolean;
}

function QueryForm({ onSubmit, isLoading }: QueryFormProps) {
  const [query, setQuery] = useState('');
  const [maxDepth, setMaxDepth] = useState<number>(2);
  const [limit, setLimit] = useState<number>(50);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      return;
    }
    onSubmit({
      query: query.trim(),
      maxDepth,
      limit,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="query-form">
      <div className="form-group">
        <label htmlFor="query">Query</label>
        <textarea
          id="query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your question about the knowledge graph... (e.g., 'Who works on machine learning projects?')"
          rows={3}
          disabled={isLoading}
          required
        />
        <small className="form-hint">
          🔍 Using semantic vector search - queries are automatically matched to relevant entities based on meaning
        </small>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="maxDepth">Max Depth</label>
          <input
            id="maxDepth"
            type="number"
            min="1"
            max="5"
            value={maxDepth}
            onChange={(e) => setMaxDepth(Number.parseInt(e.target.value, 10))}
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="limit">Limit</label>
          <input
            id="limit"
            type="number"
            min="1"
            max="200"
            value={limit}
            onChange={(e) => setLimit(Number.parseInt(e.target.value, 10))}
            disabled={isLoading}
          />
        </div>
      </div>

      <button type="submit" disabled={isLoading || !query.trim()}>
        {isLoading ? 'Querying...' : 'Query GraphRAG'}
      </button>
    </form>
  );
}

export default QueryForm;
