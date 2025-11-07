import { useState } from 'react';
import type { GraphRAGResponse, ApiError, Entity, Relationship, Document } from '../api.ts';
import GraphRenderer from './GraphRenderer.tsx';

interface ResultsProps {
  response: GraphRAGResponse | ApiError | null;
}

function Results({ response }: ResultsProps) {
  if (!response) {
    return null;
  }

  // Check if it's an error response
  if ('error' in response) {
    return (
      <div className="results error">
        <h2>Error</h2>
        <p className="error-message">{response.message}</p>
        {response.hint && <p className="error-hint">{response.hint}</p>}
      </div>
    );
  }

  // Success response
  const { context, answer } = response;

  // Check if any entities have similarity scores (indicating vector search was used)
  const hasVectorSearch = context.entities.some(
    e => e.properties._similarity !== undefined
  );

  return (
    <div className="results">
      <section className="answer-section">
        <h2>Answer</h2>
        {hasVectorSearch && (
          <div className="search-info">
            <span className="search-badge">🔍 Semantic Search</span>
            <span className="search-description">
              Results found using vector similarity search
            </span>
          </div>
        )}
        <div className="answer-content">{answer}</div>
      </section>

      <section className="context-section">
        <h2>Graph Context</h2>
        {context.summary && (
          <div className="context-summary">
            <strong>Summary:</strong> {context.summary}
          </div>
        )}

        {context.documents && context.documents.length > 0 && (
          <div className="documents">
            <h3>Documents ({context.documents.length})</h3>
            <div className="documents-list">
              {context.documents.map((document) => (
                <DocumentCard key={document.id} document={document} />
              ))}
            </div>
          </div>
        )}

        {context.entities.length > 0 && context.relationships.length > 0 && (
          <div className="graph-visualization">
            <h3>Graph Visualization</h3>
            <GraphRenderer entities={context.entities} relationships={context.relationships} />
          </div>
        )}

        {context.entities.length > 0 && (
          <div className="entities">
            <h3>Entities ({context.entities.length})</h3>
            <div className="entities-list">
              {context.entities.map((entity) => (
                <EntityCard key={entity.id} entity={entity} />
              ))}
            </div>
          </div>
        )}

        {context.relationships.length > 0 && (
          <div className="relationships">
            <h3>Relationships ({context.relationships.length})</h3>
            <div className="relationships-list">
              {context.relationships.map((rel) => (
                <RelationshipCard key={rel.id} relationship={rel} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function EntityCard({ entity }: { entity: Entity }) {
  // Filter out internal properties that shouldn't be displayed
  const internalKeys = ['embedding', '_similarity'];
  const displayProperties = Object.entries(entity.properties).filter(
    ([key]) => !internalKeys.includes(key)
  );
  
  // Get similarity score if available (from vector search)
  const similarity = entity.properties._similarity as number | undefined;
  const hasEmbedding = entity.properties.embedding !== undefined;

  return (
    <div className="entity-card">
      <div className="entity-header">
        <span className="entity-label">{entity.label}</span>
        <span className="entity-id">#{entity.id}</span>
        {similarity !== undefined && (
          <span className="similarity-badge" title={`Similarity score: ${(similarity * 100).toFixed(1)}%`}>
            {(similarity * 100).toFixed(0)}% match
          </span>
        )}
        {hasEmbedding && !similarity && (
          <span className="vector-badge" title="This entity has vector embeddings for semantic search">
            🔍 Vector
          </span>
        )}
      </div>
      {displayProperties.length > 0 && (
        <div className="entity-properties">
          {displayProperties.map(([key, value]) => (
            <div key={key} className="property">
              <span className="property-key">{key}:</span>
              <span className="property-value">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RelationshipCard({ relationship }: { relationship: Relationship }) {
  return (
    <div className="relationship-card">
      <div className="relationship-path">
        <span className="entity-id">{relationship.from}</span>
        <span className="relationship-type">--[{relationship.type}]--</span>
        <span className="entity-id">{relationship.to}</span>
      </div>
      {Object.keys(relationship.properties).length > 0 && (
        <div className="relationship-properties">
          {Object.entries(relationship.properties).map(([key, value]) => (
            <div key={key} className="property">
              <span className="property-key">{key}:</span>
              <span className="property-value">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentCard({ document }: { document: Document }) {
  const text = document.properties.text;
  const previewLength = 300;
  const preview = text.length > previewLength ? text.substring(0, previewLength) + '...' : text;
  const hasMore = text.length > previewLength;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="document-card">
      <div className="document-header">
        <span className="document-label">📄 Document</span>
        <span className="document-id">#{document.id}</span>
        {document.properties.contextId && (
          <span className="context-badge" title={`Context ID: ${document.properties.contextId}`}>
            Context
          </span>
        )}
      </div>
      <div className="document-text">
        {expanded ? (
          <div>
            <pre className="document-content">{text}</pre>
            {hasMore && (
              <button
                className="expand-button"
                onClick={() => setExpanded(false)}
                type="button"
              >
                Show Less
              </button>
            )}
          </div>
        ) : (
          <div>
            <pre className="document-content">{preview}</pre>
            {hasMore && (
              <button
                className="expand-button"
                onClick={() => setExpanded(true)}
                type="button"
              >
                Show More
              </button>
            )}
          </div>
        )}
      </div>
      {document.properties.metadata && Object.keys(document.properties.metadata).length > 0 && (
        <div className="document-metadata">
          <strong>Metadata:</strong>
          <pre>{JSON.stringify(document.properties.metadata, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default Results;
