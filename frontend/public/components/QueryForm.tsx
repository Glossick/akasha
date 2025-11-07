import { useState } from 'react';
import type { GraphRAGQuery, QueryStrategy } from '../api.ts';

interface QueryFormProps {
  onSubmit: (query: GraphRAGQuery) => void;
  isLoading: boolean;
}

function QueryForm({ onSubmit, isLoading }: QueryFormProps) {
  const [query, setQuery] = useState('');
  const [maxDepth, setMaxDepth] = useState<number>(2);
  const [limit, setLimit] = useState<number>(50);
  const [strategy, setStrategy] = useState<QueryStrategy>('both');
  const [includeEmbeddings, setIncludeEmbeddings] = useState<boolean>(false);
  const [validAt, setValidAt] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      return;
    }
    onSubmit({
      query: query.trim(),
      maxDepth,
      limit,
      strategy,
      includeEmbeddings,
      validAt: validAt ? validAt : undefined,
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

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="strategy">Query Strategy</label>
          <select
            id="strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as QueryStrategy)}
            disabled={isLoading}
          >
            <option value="both">Both (Documents & Entities)</option>
            <option value="documents">Documents Only</option>
            <option value="entities">Entities Only</option>
          </select>
          <small className="form-hint">
            {strategy === 'both' && 'Searches both documents and entities, combining results'}
            {strategy === 'documents' && 'Searches only documents, then retrieves connected entities'}
            {strategy === 'entities' && 'Searches only entities (original behavior)'}
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="includeEmbeddings" className="checkbox-label">
            <input
              id="includeEmbeddings"
              type="checkbox"
              checked={includeEmbeddings}
              onChange={(e) => setIncludeEmbeddings(e.target.checked)}
              disabled={isLoading}
            />
            <span>Include Embeddings</span>
          </label>
          <small className="form-hint">
            Include vector embeddings in response (increases payload size)
          </small>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="validAt">Valid At (Temporal Filter)</label>
        <input
          id="validAt"
          type="datetime-local"
          value={validAt}
          onChange={(e) => setValidAt(e.target.value)}
          disabled={isLoading}
        />
        <small className="form-hint">
          Only return facts valid at this time (optional). Leave empty to return all facts.
        </small>
      </div>

      <button type="submit" disabled={isLoading || !query.trim()}>
        {isLoading ? 'Querying...' : 'Query GraphRAG'}
      </button>
    </form>
  );
}

export default QueryForm;
