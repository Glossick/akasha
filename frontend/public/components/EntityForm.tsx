import { useState } from 'react';
import { createEntity } from '../api.ts';
import { validateLabel } from '../utils/validation.ts';
import type { CreateEntityRequest, Entity, ApiError } from '../api.ts';

interface EntityFormProps {
  onSubmit: (entity: Entity) => void;
  onError?: (error: string) => void;
  isLoading?: boolean;
}

function EntityForm({ onSubmit, onError, isLoading = false }: EntityFormProps) {
  const [label, setLabel] = useState('');
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [propertyKey, setPropertyKey] = useState('');
  const [propertyValue, setPropertyValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleAddProperty = () => {
    if (!propertyKey.trim() || !propertyValue.trim()) {
      return;
    }

    setProperties((prev) => ({
      ...prev,
      [propertyKey.trim()]: propertyValue.trim(),
    }));

    setPropertyKey('');
    setPropertyValue('');
  };

  const handleRemoveProperty = (key: string) => {
    setProperties((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate label
    const labelValidation = validateLabel(label);
    if (!labelValidation.valid) {
      setValidationError(labelValidation.error || 'Invalid label');
      return;
    }

    if (Object.keys(properties).length === 0) {
      setValidationError('At least one property is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const request: CreateEntityRequest = {
        label,
        properties: Object.fromEntries(
          Object.entries(properties).map(([key, value]) => {
            // Try to parse as number or boolean, otherwise keep as string
            const numValue = Number(value);
            if (!Number.isNaN(numValue) && value.trim() !== '') {
              return [key, numValue];
            }
            if (value === 'true' || value === 'false') {
              return [key, value === 'true'];
            }
            return [key, value];
          })
        ),
      };

      const result = await createEntity(request);

      if ('error' in result) {
        const error = result as ApiError;
        setValidationError(error.message);
        onError?.(error.message);
      } else {
        onSubmit(result);
        // Reset form
        setLabel('');
        setProperties({});
        setPropertyKey('');
        setPropertyValue('');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create entity';
      setValidationError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="entity-form">
      <h3>Create Entity</h3>

      <div className="form-group">
        <label htmlFor="entity-label">Label *</label>
        <input
          id="entity-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Person, Company, Project..."
          disabled={isSubmitting || isLoading}
          required
        />
        <small>Must start with uppercase letter (e.g., Person, Company)</small>
      </div>

      <div className="form-group">
        <label>Properties *</label>
        <div className="property-inputs">
          <input
            type="text"
            placeholder="Property key (e.g., name)"
            value={propertyKey}
            onChange={(e) => setPropertyKey(e.target.value)}
            disabled={isSubmitting || isLoading}
          />
          <input
            type="text"
            placeholder="Property value"
            value={propertyValue}
            onChange={(e) => setPropertyValue(e.target.value)}
            disabled={isSubmitting || isLoading}
          />
          <button
            type="button"
            onClick={handleAddProperty}
            disabled={isSubmitting || isLoading || !propertyKey.trim() || !propertyValue.trim()}
          >
            Add
          </button>
        </div>

        {Object.keys(properties).length > 0 && (
          <div className="properties-list">
            {Object.entries(properties).map(([key, value]) => (
              <div key={key} className="property-item">
                <span className="property-key">{key}:</span>
                <span className="property-value">{value}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveProperty(key)}
                  disabled={isSubmitting || isLoading}
                  className="remove-button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {validationError && (
        <div className="error-message">{validationError}</div>
      )}

      <button type="submit" disabled={isSubmitting || isLoading || !label.trim() || Object.keys(properties).length === 0}>
        {isSubmitting ? 'Creating...' : 'Create Entity'}
      </button>
    </form>
  );
}

export default EntityForm;

