import { useState, Fragment } from 'react';
import { extractTextToGraph } from '../api.ts';
import type { ExtractTextResponse, ApiError } from '../api.ts';

interface TextExtractionFormProps {
  onExtracted?: (response: ExtractTextResponse) => void;
  onError?: (error: string) => void;
  isLoading?: boolean;
}

function TextExtractionForm({ onExtracted, onError, isLoading = false }: TextExtractionFormProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractTextResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExtractionResult(null);

    if (!text.trim()) {
      setError('Please enter some text to extract');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await extractTextToGraph(text.trim());

      if ('error' in result) {
        const apiError = result as ApiError;
        const errorMessage = apiError.message || 'Failed to extract graph structure';
        setError(errorMessage);
        onError?.(errorMessage);
      } else {
        setExtractionResult(result);
        onExtracted?.(result);
        // Clear the text after successful extraction
        setText('');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract graph structure';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="text-extraction-form">
      <h3>Extract from Natural Language</h3>
      <p className="form-description">
        Enter natural language text describing entities and relationships. The system will automatically extract and create them in the graph with vector embeddings for semantic search.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="extraction-text">Text</label>
          <textarea
            id="extraction-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Example: Alice works at TechCorp as an engineer. She is 30 years old and lives in San Francisco. TechCorp is located in California and has 500 employees."
            disabled={isSubmitting || isLoading}
            rows={6}
            required
            className="text-input"
          />
          <small>
            Describe entities (people, places, organizations, etc.) and their relationships. The AI will extract and create them automatically.
          </small>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || isLoading || !text.trim()}
          className="submit-button"
        >
          {isSubmitting ? 'Extracting...' : 'Extract & Create Graph'}
        </button>
      </form>

      {extractionResult && (
        <div className="extraction-result">
          <div className="success-banner">
            <strong>Success!</strong> Extracted and created graph structure from text.
          </div>
          <div className="result-summary">
            <div className="result-stat">
              <strong>{extractionResult.created.document === 1 ? 'Created' : 'Reused'}</strong> document
              {extractionResult.created.document === 0 && (
                <span className="deduplication-badge" title="Document was deduplicated - same text already exists in graph">
                  🔄 Deduplicated
                </span>
              )}
            </div>
            <div className="result-stat">
              <strong>{extractionResult.created.entities}</strong> entities created
            </div>
            <div className="result-stat">
              <strong>{extractionResult.created.relationships}</strong> relationships created
            </div>
          </div>
          {extractionResult.document && (
            <div className="document-info">
              <h4>Document:</h4>
              <div className="document-preview">
                <span className="document-id">ID: {extractionResult.document.id}</span>
                <pre className="document-text-preview">
                  {extractionResult.document.properties.text.length > 200
                    ? extractionResult.document.properties.text.substring(0, 200) + '...'
                    : extractionResult.document.properties.text}
                </pre>
              </div>
            </div>
          )}
          <details className="result-details">
            <summary>View Details</summary>
            <div className="details-content">
              <h4>Entities:</h4>
              <ul>
                {extractionResult.entities.map((entity) => (
                  <li key={entity.id}>
                    <strong>{entity.label}</strong>: {entity.properties.name as string || entity.properties.title as string || entity.id}
                    {Object.keys(entity.properties).length > 1 && (
                      <span className="properties-count">
                        {' '}({Object.keys(entity.properties).length} properties)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {extractionResult.relationships.length > 0 && (
                <Fragment>
                  <h4>Relationships:</h4>
                  <ul>
                    {extractionResult.relationships.map((rel) => {
                      const fromEntity = extractionResult.entities.find(e => e.id === rel.from);
                      const toEntity = extractionResult.entities.find(e => e.id === rel.to);
                      const fromName = fromEntity 
                        ? (fromEntity.properties.name as string || fromEntity.properties.title as string || rel.from)
                        : rel.from;
                      const toName = toEntity 
                        ? (toEntity.properties.name as string || toEntity.properties.title as string || rel.to)
                        : rel.to;
                      return (
                        <li key={rel.id}>
                          <strong>{fromName}</strong> --[{rel.type}]--&gt; <strong>{toName}</strong>
                        </li>
                      );
                    })}
                  </ul>
                </Fragment>
              )}
              <pre className="summary-text">{extractionResult.summary}</pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

export default TextExtractionForm;

