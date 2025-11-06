import { useState, Fragment } from 'react';
import QueryForm from './components/QueryForm.tsx';
import Results from './components/Results.tsx';
import StatusIndicator from './components/StatusIndicator.tsx';
import GraphManager from './components/GraphManager.tsx';
import { queryGraphRAG } from './api.ts';
import type { GraphRAGQuery, GraphRAGResponse, ApiError, Entity, Relationship } from './api.ts';

type Tab = 'query' | 'manage';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('query');
  const [response, setResponse] = useState<GraphRAGResponse | ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleQuery = async (query: GraphRAGQuery) => {
    setIsLoading(true);
    setError(null);
    setResponse(null);
    setSuccessMessage(null);

    try {
      const result = await queryGraphRAG(query);
      setResponse(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to query GraphRAG';
      setError(errorMessage);
      console.error('Query error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEntityCreated = (entity: Entity) => {
    setSuccessMessage(`Entity "${entity.label}" created successfully!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRelationshipCreated = (relationship: Relationship) => {
    setSuccessMessage(`Relationship "${relationship.type}" created successfully!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Semantic Map GraphRAG</h1>
        <p className="subtitle">
          Query and manage your knowledge graph with AI-powered semantic vector search
        </p>
        <StatusIndicator />
      </header>

      <nav className="app-nav">
        <button
          className={`nav-button ${activeTab === 'query' ? 'active' : ''}`}
          onClick={() => setActiveTab('query')}
        >
          Query Graph
        </button>
        <button
          className={`nav-button ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          Manage Graph
        </button>
      </nav>

      <main className="app-main">
        {successMessage && (
          <section className="success-section">
            <div className="success-banner">
              <strong>Success:</strong> {successMessage}
            </div>
          </section>
        )}

        {activeTab === 'query' && (
          <Fragment>
            <section className="query-section">
              <QueryForm onSubmit={handleQuery} isLoading={isLoading} />
            </section>

            {error && (
              <section className="error-section">
                <div className="error-banner">
                  <strong>Error:</strong> {error}
                </div>
              </section>
            )}

            {response && (
              <section className="results-section">
                <Results response={response} />
              </section>
            )}
          </Fragment>
        )}

        {activeTab === 'manage' && (
          <section className="manage-section">
            <GraphManager
              onEntityCreated={handleEntityCreated}
              onRelationshipCreated={handleRelationshipCreated}
            />
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>Semantic Map GraphRAG System</p>
      </footer>
    </div>
  );
}

export default App;

