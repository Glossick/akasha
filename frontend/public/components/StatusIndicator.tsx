import { useEffect, useState } from 'react';
import { checkHealth, testNeo4j } from '../api.ts';
import type { HealthStatus, Neo4jTestResponse } from '../api.ts';

function StatusIndicator() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [neo4jStatus, setNeo4jStatus] = useState<Neo4jTestResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      try {
        setIsLoading(true);
        const [healthResult, neo4jResult] = await Promise.all([
          checkHealth(),
          testNeo4j(),
        ]);
        setHealth(healthResult);
        setNeo4jStatus(neo4jResult);
      } catch (error) {
        console.error('Failed to check status:', error);
      } finally {
        setIsLoading(false);
      }
    }

    checkStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="status-indicator">
        <span className="status-dot loading" />
        <span>Checking status...</span>
      </div>
    );
  }

  const isHealthy = health?.status === 'ok';
  const isNeo4jConnected = neo4jStatus?.status === 'connected';

  return (
    <div className="status-indicator">
      <div className="status-item">
        <span
          className={`status-dot ${isHealthy ? 'connected' : 'disconnected'}`}
        />
        <span>API: {health?.status || 'unknown'}</span>
      </div>
      <div className="status-item">
        <span
          className={`status-dot ${isNeo4jConnected ? 'connected' : 'disconnected'}`}
        />
        <span>Neo4j: {neo4jStatus?.status || 'unknown'}</span>
      </div>
      {!isNeo4jConnected && neo4jStatus?.hint && (
        <div className="status-hint">{neo4jStatus.hint}</div>
      )}
    </div>
  );
}

export default StatusIndicator;
