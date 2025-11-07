import { useState, useEffect, Fragment } from 'react';
import { listEntities, getEntity, deleteEntity, updateEntity } from '../api.ts';
import type { Entity, ApiError } from '../api.ts';
import EntityUpdateForm from './EntityUpdateForm.tsx';

interface EntityListProps {
  onEntityUpdated?: (entity: Entity) => void;
  onEntityDeleted?: (id: string) => void;
  onError?: (error: string) => void;
}

function EntityList({ onEntityUpdated, onEntityDeleted, onError }: EntityListProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [labelFilter, setLabelFilter] = useState('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const loadEntities = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listEntities({
        label: labelFilter || undefined,
        limit,
        offset,
      });

      if ('error' in result) {
        const apiError = result as ApiError;
        setError(apiError.message);
        onError?.(apiError.message);
      } else {
        setEntities(result);
        // If we got a full page, there might be more
        if (result.length === limit) {
          setTotalCount(offset + result.length + 1); // Estimate
        } else {
          setTotalCount(offset + result.length);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load entities';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEntities();
  }, [labelFilter, limit, offset]);

  const handleEntitySelect = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getEntity(id);
      if ('error' in result) {
        setError(result.message);
      } else {
        setSelectedEntity(result);
        setEditingEntity(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entity');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEntityDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entity?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await deleteEntity(id);
      if ('error' in result) {
        setError(result.message);
        onError?.(result.message);
      } else {
        setEntities((prev) => prev.filter((e) => e.id !== id));
        if (selectedEntity?.id === id) {
          setSelectedEntity(null);
        }
        if (editingEntity?.id === id) {
          setEditingEntity(null);
        }
        onEntityDeleted?.(id);
        // Reload to refresh list
        loadEntities();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete entity';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEntityUpdate = (updatedEntity: Entity) => {
    setEntities((prev) =>
      prev.map((e) => (e.id === updatedEntity.id ? updatedEntity : e))
    );
    if (selectedEntity?.id === updatedEntity.id) {
      setSelectedEntity(updatedEntity);
    }
    setEditingEntity(null);
    onEntityUpdated?.(updatedEntity);
  };

  const handleEditEntity = (entity: Entity) => {
    setEditingEntity(entity);
    setSelectedEntity(null);
  };

  return (
    <div className="entity-list-component">
      <div className="list-header">
        <h3>All Entities</h3>
        <div className="list-controls">
          <div className="form-group">
            <label htmlFor="label-filter">Filter by Label</label>
            <input
              id="label-filter"
              type="text"
              value={labelFilter}
              onChange={(e) => {
                setLabelFilter(e.target.value);
                setOffset(0);
              }}
              placeholder="Person, Company..."
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="limit">Items per Page</label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => {
                setLimit(Number.parseInt(e.target.value, 10));
                setOffset(0);
              }}
              disabled={isLoading}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <button onClick={loadEntities} disabled={isLoading}>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}

      {isLoading && entities.length === 0 ? (
        <div className="loading-state">Loading entities...</div>
      ) : entities.length === 0 ? (
        <div className="empty-state">No entities found.</div>
      ) : (
        <>
          <div className="entities-list">
            {entities.map((entity) => {
              const internalKeys = ['embedding', '_similarity', 'scopeId', 'contextIds', '_recordedAt', '_validFrom', '_validTo'];
              const displayProperties = Object.entries(entity.properties).filter(
                ([key]) => !internalKeys.includes(key)
              );
              const hasEmbedding = entity.properties.embedding !== undefined;

              return (
                <div key={entity.id} className="entity-item">
                  <div className="entity-header">
                    <span className="entity-label">{entity.label}</span>
                    <span className="entity-id">#{entity.id}</span>
                    {hasEmbedding && (
                      <span className="vector-badge" title="Has vector embeddings">
                        🔍 Vector
                      </span>
                    )}
                  </div>
                  <div className="entity-actions">
                    <button
                      onClick={() => handleEntitySelect(entity.id)}
                      disabled={isLoading}
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditEntity(entity)}
                      disabled={isLoading}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleEntityDelete(entity.id)}
                      disabled={isLoading}
                      className="delete-button"
                    >
                      Delete
                    </button>
                  </div>
                  {displayProperties.length > 0 && (
                    <div className="entity-properties">
                      {displayProperties.slice(0, 3).map(([key, value]) => (
                        <div key={key} className="property">
                          <span className="property-key">{key}:</span>
                          <span className="property-value">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                      {displayProperties.length > 3 && (
                        <div className="property-more">+{displayProperties.length - 3} more</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pagination">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={isLoading || offset === 0}
            >
              Previous
            </button>
            <span className="pagination-info">
              Showing {offset + 1} - {offset + entities.length}
              {totalCount !== null && ` of ~${totalCount}`}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={isLoading || entities.length < limit}
            >
              Next
            </button>
          </div>
        </>
      )}

      {selectedEntity && !editingEntity && (
        <div className="entity-detail">
          <h4>Entity Details</h4>
          <div className="detail-content">
            <div className="detail-item">
              <strong>ID:</strong> {selectedEntity.id}
            </div>
            <div className="detail-item">
              <strong>Label:</strong> {selectedEntity.label}
            </div>
            <div className="detail-item">
              <strong>Properties:</strong>
              <pre>
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(selectedEntity.properties).filter(
                      ([key]) => !['embedding', '_similarity', 'scopeId', 'contextIds', '_recordedAt', '_validFrom', '_validTo'].includes(key)
                    )
                  ),
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
          <div className="detail-actions">
            <button onClick={() => handleEditEntity(selectedEntity)}>Edit</button>
            <button onClick={() => setSelectedEntity(null)}>Close</button>
          </div>
        </div>
      )}

      {editingEntity && (
        <div className="entity-edit">
          <h4>Edit Entity</h4>
          <EntityUpdateForm
            entity={editingEntity}
            onUpdated={handleEntityUpdate}
            onError={(err) => {
              setError(err);
              onError?.(err);
            }}
            onCancel={() => setEditingEntity(null)}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}

export default EntityList;

