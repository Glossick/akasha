import { useState, Fragment } from 'react';
import { batchExtractTextToGraph } from '../api.ts';
import type { BatchLearnResponse, ApiError, BatchLearnItem } from '../api.ts';

interface BatchExtractionFormProps {
  onExtracted?: (response: BatchLearnResponse) => void;
  onError?: (error: string) => void;
  isLoading?: boolean;
}

function BatchExtractionForm({ onExtracted, onError, isLoading = false }: BatchExtractionFormProps) {
  const [texts, setTexts] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<BatchLearnResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextName, setContextName] = useState<string>('');
  const [validFrom, setValidFrom] = useState<string>('');
  const [validTo, setValidTo] = useState<string>('');

  const addTextInput = () => {
    setTexts([...texts, '']);
  };

  const removeTextInput = (index: number) => {
    setTexts(texts.filter((_, i) => i !== index));
  };

  const updateText = (index: number, value: string) => {
    const newTexts = [...texts];
    newTexts[index] = value;
    setTexts(newTexts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExtractionResult(null);

    const validTexts = texts.filter(t => t.trim().length > 0);
    if (validTexts.length === 0) {
      setError('Please enter at least one text to extract');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await batchExtractTextToGraph({
        items: validTexts,
        contextName: contextName || undefined,
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
      });

      if ('error' in result) {
        const apiError = result as ApiError;
        const errorMessage = apiError.message || 'Failed to extract graph structure';
        setError(errorMessage);
        onError?.(errorMessage);
      } else {
        setExtractionResult(result);
        onExtracted?.(result);
        // Clear the texts after successful extraction
        setTexts(['']);
        setContextName('');
        setValidFrom('');
        setValidTo('');
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
    <div className="batch-extraction-form">
      <h3>Batch Extract from Natural Language</h3>
      <p className="form-description">
        Enter multiple texts to extract and create graph structures in batch. All texts will be processed sequentially.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="batch-context-name">Context Name (Optional)</label>
          <input
            id="batch-context-name"
            type="text"
            value={contextName}
            onChange={(e) => setContextName(e.target.value)}
            placeholder="e.g., Batch Import"
            disabled={isSubmitting || isLoading}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="batch-validFrom">Valid From (Optional)</label>
            <input
              id="batch-validFrom"
              type="datetime-local"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              disabled={isSubmitting || isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="batch-validTo">Valid To (Optional)</label>
            <input
              id="batch-validTo"
              type="datetime-local"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              disabled={isSubmitting || isLoading}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Texts to Extract</label>
          {texts.map((text, index) => (
            <div key={index} className="batch-text-input">
              <textarea
                value={text}
                onChange={(e) => updateText(index, e.target.value)}
                placeholder={`Text ${index + 1}: Enter natural language text...`}
                disabled={isSubmitting || isLoading}
                rows={3}
                className="text-input"
              />
              {texts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTextInput(index)}
                  disabled={isSubmitting || isLoading}
                  className="remove-button"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addTextInput}
            disabled={isSubmitting || isLoading}
            className="add-button"
          >
            + Add Another Text
          </button>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || isLoading || texts.every(t => !t.trim())}
          className="submit-button"
        >
          {isSubmitting ? 'Extracting...' : 'Extract & Create Graph (Batch)'}
        </button>
      </form>

      {extractionResult && (
        <div className="extraction-result">
          <div className="success-banner">
            <strong>Batch Extraction Complete!</strong>
          </div>
          <div className="result-summary">
            <div className="result-stat">
              <strong>{extractionResult.summary.succeeded}</strong> of <strong>{extractionResult.summary.total}</strong> succeeded
            </div>
            {extractionResult.summary.failed > 0 && (
              <div className="result-stat error">
                <strong>{extractionResult.summary.failed}</strong> failed
              </div>
            )}
            <div className="result-stat">
              <strong>{extractionResult.summary.totalDocumentsCreated}</strong> documents created
            </div>
            <div className="result-stat">
              <strong>{extractionResult.summary.totalDocumentsReused}</strong> documents reused
            </div>
            <div className="result-stat">
              <strong>{extractionResult.summary.totalEntitiesCreated}</strong> entities created
            </div>
            <div className="result-stat">
              <strong>{extractionResult.summary.totalRelationshipsCreated}</strong> relationships created
            </div>
          </div>
          {extractionResult.errors && extractionResult.errors.length > 0 && (
            <div className="error-details">
              <h4>Errors:</h4>
              <ul>
                {extractionResult.errors.map((err, idx) => (
                  <li key={idx}>
                    <strong>Item {err.index + 1}:</strong> {err.error}
                    <pre className="error-text">{err.text.substring(0, 100)}...</pre>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details className="result-details">
            <summary>View Individual Results</summary>
            <div className="details-content">
              {extractionResult.results.map((result, idx) => (
                <div key={idx} className="individual-result">
                  <h4>Result {idx + 1}</h4>
                  <div className="result-stat">
                    Document: {result.created.document === 1 ? 'Created' : 'Reused'} ({result.document.id})
                  </div>
                  <div className="result-stat">
                    {result.created.entities} entities, {result.created.relationships} relationships
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

export default BatchExtractionForm;

