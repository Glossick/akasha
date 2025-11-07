import { useState, useEffect } from 'react';
import EntityForm from './EntityForm.tsx';
import RelationshipForm from './RelationshipForm.tsx';
import TextExtractionForm from './TextExtractionForm.tsx';
import EntityList from './EntityList.tsx';
import { getEntity, deleteEntity } from '../api.ts';
import type { Entity, Relationship, ApiError, ExtractTextResponse } from '../api.ts';

interface GraphManagerProps {
  onEntityCreated?: (entity: Entity) => void;
  onRelationshipCreated?: (relationship: Relationship) => void;
}

function GraphManager({ onEntityCreated, onRelationshipCreated }: GraphManagerProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load entities when component mounts (simplified - in real app, would have list endpoint)
  // For now, we'll track entities created in this session
  const handleEntityCreated = (entity: Entity) => {
    setEntities((prev) => [...prev, entity]);
    onEntityCreated?.(entity);
    setError(null);
  };

  const handleRelationshipCreated = (relationship: Relationship) => {
    onRelationshipCreated?.(relationship);
    setError(null);
  };

  const handleTextExtracted = (response: ExtractTextResponse) => {
    // Add all extracted entities to the entities list
    setEntities((prev) => {
      const existingIds = new Set(prev.map(e => e.id));
      const newEntities = response.entities.filter(e => !existingIds.has(e.id));
      return [...prev, ...newEntities];
    });
    
    // Notify parent about created entities and relationships
    response.entities.forEach(entity => onEntityCreated?.(entity));
    response.relationships.forEach(rel => onRelationshipCreated?.(rel));
    
    setError(null);
  };

  const handleEntitySelect = async (id: string) => {
    setIsLoadingEntities(true);
    setError(null);

    try {
      const result = await getEntity(id);
      if ('error' in result) {
        setError(result.message);
      } else {
        setSelectedEntity(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entity');
    } finally {
      setIsLoadingEntities(false);
    }
  };

  const handleDeleteEntity = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entity?')) {
      return;
    }

    try {
      const result = await deleteEntity(id);
      if ('error' in result) {
        setError(result.message);
      } else {
        setEntities((prev) => prev.filter((e) => e.id !== id));
        if (selectedEntity?.id === id) {
          setSelectedEntity(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entity');
    }
  };

  return (
    <div className="graph-manager">
      <div className="manager-header">
        <h2>Manage Knowledge Graph</h2>
        <p>Create entities and relationships to build your knowledge graph</p>
      </div>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="manager-content">
        <section className="extraction-section">
          <div className="form-panel full-width">
            <TextExtractionForm
              onExtracted={handleTextExtracted}
              onError={setError}
              isLoading={isLoadingEntities}
            />
          </div>
        </section>

        <section className="create-section">
          <h3>Manual Creation</h3>
          <p className="section-description">Or create entities and relationships manually:</p>
          <div className="create-forms">
            <div className="form-panel">
              <EntityForm
                onSubmit={handleEntityCreated}
                onError={setError}
                isLoading={isLoadingEntities}
              />
            </div>

            <div className="form-panel">
              <RelationshipForm
                entities={entities}
                onSubmit={handleRelationshipCreated}
                onError={setError}
                isLoading={isLoadingEntities}
              />
            </div>
          </div>
        </section>

        <section className="entities-section">
          <h3>Session Entities ({entities.length})</h3>
          {entities.length === 0 ? (
            <p className="empty-state">No entities created in this session. Create one above to get started.</p>
          ) : (
            <div className="entities-list">
              {entities.map((entity) => {
                // Filter out internal properties for display
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
                      <span className="vector-badge" title="This entity has vector embeddings for semantic search">
                        🔍 Vector
                      </span>
                    )}
                  </div>
                  <div className="entity-actions">
                    <button
                      onClick={() => handleEntitySelect(entity.id)}
                      disabled={isLoadingEntities}
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDeleteEntity(entity.id)}
                      disabled={isLoadingEntities}
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
          )}

          {selectedEntity && (
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
                  <pre>{JSON.stringify(
                    Object.fromEntries(
                      Object.entries(selectedEntity.properties).filter(
                        ([key]) => !['embedding', '_similarity', 'scopeId', 'contextIds', '_recordedAt', '_validFrom', '_validTo'].includes(key)
                      )
                    ),
                    null,
                    2
                  )}</pre>
                </div>
              </div>
              <button onClick={() => setSelectedEntity(null)}>Close</button>
            </div>
          )}
        </section>

        <section className="all-entities-section">
          <EntityList
            onEntityUpdated={(entity) => {
              // Update session entities if it exists there
              setEntities((prev) =>
                prev.map((e) => (e.id === entity.id ? entity : e))
              );
              if (selectedEntity?.id === entity.id) {
                setSelectedEntity(entity);
              }
              onEntityCreated?.(entity);
            }}
            onEntityDeleted={(id) => {
              setEntities((prev) => prev.filter((e) => e.id !== id));
              if (selectedEntity?.id === id) {
                setSelectedEntity(null);
              }
            }}
            onError={setError}
          />
        </section>
      </div>
    </div>
  );
}

export default GraphManager;

