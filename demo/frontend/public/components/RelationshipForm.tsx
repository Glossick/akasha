import { useState, useEffect } from 'react';
import { createRelationship, getEntity } from '../api.ts';
import { validateRelationshipType } from '../utils/validation.ts';
import type { CreateRelationshipRequest, Relationship, Entity, ApiError } from '../api.ts';

interface RelationshipFormProps {
  entities: Entity[];
  onSubmit: (relationship: Relationship) => void;
  onError?: (error: string) => void;
  isLoading?: boolean;
}

function RelationshipForm({ entities, onSubmit, onError, isLoading = false }: RelationshipFormProps) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [type, setType] = useState('');
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [propertyKey, setPropertyKey] = useState('');
  const [propertyValue, setPropertyValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fromEntity, setFromEntity] = useState<Entity | null>(null);
  const [toEntity, setToEntity] = useState<Entity | null>(null);

  // Load entity details when IDs change
  useEffect(() => {
    if (fromId) {
      getEntity(fromId).then((result) => {
        if (!('error' in result)) {
          setFromEntity(result);
        }
      });
    } else {
      setFromEntity(null);
    }
  }, [fromId]);

  useEffect(() => {
    if (toId) {
      getEntity(toId).then((result) => {
        if (!('error' in result)) {
          setToEntity(result);
        }
      });
    } else {
      setToEntity(null);
    }
  }, [toId]);

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

    // Validate relationship type
    const typeValidation = validateRelationshipType(type);
    if (!typeValidation.valid) {
      setValidationError(typeValidation.error || 'Invalid relationship type');
      return;
    }

    if (!fromId || !toId) {
      setValidationError('Both source and target entities are required');
      return;
    }

    if (fromId === toId) {
      setValidationError('Source and target entities must be different');
      return;
    }

    setIsSubmitting(true);

    try {
      const request: CreateRelationshipRequest = {
        from: fromId,
        to: toId,
        type,
        properties: Object.keys(properties).length > 0
          ? Object.fromEntries(
              Object.entries(properties).map(([key, value]) => {
                const numValue = Number(value);
                if (!Number.isNaN(numValue) && value.trim() !== '') {
                  return [key, numValue];
                }
                if (value === 'true' || value === 'false') {
                  return [key, value === 'true'];
                }
                return [key, value];
              })
            )
          : undefined,
      };

      const result = await createRelationship(request);

      if ('error' in result) {
        const error = result as ApiError;
        setValidationError(error.message);
        onError?.(error.message);
      } else {
        onSubmit(result);
        // Reset form
        setFromId('');
        setToId('');
        setType('');
        setProperties({});
        setPropertyKey('');
        setPropertyValue('');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create relationship';
      setValidationError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relationship-form">
      <h3>Create Relationship</h3>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="relationship-from">From Entity *</label>
          <select
            id="relationship-from"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            disabled={isSubmitting || isLoading}
            required
          >
            <option value="">Select entity...</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.label} ({entity.properties.name || entity.id})
              </option>
            ))}
          </select>
          {fromEntity && (
            <small>{fromEntity.label}: {JSON.stringify(fromEntity.properties)}</small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="relationship-to">To Entity *</label>
          <select
            id="relationship-to"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            disabled={isSubmitting || isLoading}
            required
          >
            <option value="">Select entity...</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.label} ({entity.properties.name || entity.id})
              </option>
            ))}
          </select>
          {toEntity && (
            <small>{toEntity.label}: {JSON.stringify(toEntity.properties)}</small>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="relationship-type">Relationship Type *</label>
        <input
          id="relationship-type"
          type="text"
          value={type}
          onChange={(e) => setType(e.target.value.toUpperCase())}
          placeholder="WORKS_FOR, KNOWS, WORKS_ON..."
          disabled={isSubmitting || isLoading}
          required
        />
        <small>Must be uppercase (e.g., WORKS_FOR, KNOWS)</small>
      </div>

      <div className="form-group">
        <label>Properties (Optional)</label>
        <div className="property-inputs">
          <input
            type="text"
            placeholder="Property key"
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

      <button
        type="submit"
        disabled={isSubmitting || isLoading || !fromId || !toId || !type.trim()}
      >
        {isSubmitting ? 'Creating...' : 'Create Relationship'}
      </button>
    </form>
  );
}

export default RelationshipForm;

