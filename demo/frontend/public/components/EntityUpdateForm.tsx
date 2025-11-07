import { useState } from 'react';
import { updateEntity } from '../api.ts';
import type { Entity, ApiError } from '../api.ts';

interface EntityUpdateFormProps {
  entity: Entity;
  onUpdated: (entity: Entity) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

function EntityUpdateForm({
  entity,
  onUpdated,
  onError,
  onCancel,
  isLoading = false,
}: EntityUpdateFormProps) {
  const [properties, setProperties] = useState<Record<string, string>>(() => {
    // Initialize with existing properties (excluding internal/system ones)
    const internalKeys = ['embedding', '_similarity', 'scopeId', 'contextIds', '_recordedAt', '_validFrom', '_validTo'];
    return Object.fromEntries(
      Object.entries(entity.properties)
        .filter(([key]) => !internalKeys.includes(key))
        .map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : String(value)])
    );
  });
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

    if (Object.keys(properties).length === 0) {
      setValidationError('At least one property is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedProperties = Object.fromEntries(
        Object.entries(properties).map(([key, value]) => {
          // Try to parse as number or boolean, otherwise keep as string
          const numValue = Number(value);
          if (!Number.isNaN(numValue) && value.trim() !== '') {
            return [key, numValue];
          }
          if (value === 'true' || value === 'false') {
            return [key, value === 'true'];
          }
          // Try to parse as JSON if it looks like JSON
          if ((value.startsWith('{') || value.startsWith('[')) && value.trim().endsWith('}') || value.trim().endsWith(']')) {
            try {
              return [key, JSON.parse(value)];
            } catch {
              // If parsing fails, keep as string
            }
          }
          return [key, value];
        })
      );

      const result = await updateEntity(entity.id, updatedProperties);

      if ('error' in result) {
        const error = result as ApiError;
        setValidationError(error.message);
        onError?.(error.message);
      } else {
        onUpdated(result);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update entity';
      setValidationError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="entity-update-form">
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

      <div className="form-actions">
        <button
          type="submit"
          disabled={isSubmitting || isLoading || Object.keys(properties).length === 0}
        >
          {isSubmitting ? 'Updating...' : 'Update Entity'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={isSubmitting || isLoading}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default EntityUpdateForm;

