import { useEffect, useRef, useState } from 'react';
import type { Entity, Relationship } from '../api.ts';

interface GraphRendererProps {
  entities: Entity[];
  relationships: Relationship[];
}

interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, unknown>;
  name?: string;
  title?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  id: string;
}

/**
 * GraphRenderer component
 * 
 * Renders a force-directed graph visualization using SVG and canvas.
 * Custom implementation that avoids external library dependencies.
 * 
 * @param entities - Array of entities to display as nodes
 * @param relationships - Array of relationships to display as links
 */
function GraphRenderer({ entities, relationships }: GraphRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const simulationRef = useRef<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);

  // Transform entities to nodes
  useEffect(() => {
    const graphNodes: GraphNode[] = entities.map((entity) => {
      const name = entity.properties.name as string | undefined;
      const title = entity.properties.title as string | undefined;
      const displayName = name || title || entity.label || entity.id;

      return {
        id: entity.id,
        label: entity.label,
        properties: entity.properties,
        name: displayName,
        title: displayName,
        x: Math.random() * 400 + 200,
        y: Math.random() * 400 + 200,
        vx: 0,
        vy: 0,
      };
    });

    // Transform relationships to links
    const graphLinks: GraphLink[] = relationships.map((rel) => {
      const sourceNode = graphNodes.find(n => n.id === rel.from);
      const targetNode = graphNodes.find(n => n.id === rel.to);
      return {
        source: sourceNode || rel.from,
        target: targetNode || rel.to,
        type: rel.type,
        id: rel.id,
      };
    }).filter(link => link.source && link.target);

    setNodes(graphNodes);
    setLinks(graphLinks);
    simulationRef.current = { nodes: graphNodes, links: graphLinks };
  }, [entities, relationships]);

  // Force simulation
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;

    let animationId: number;

    const simulate = () => {
      if (!simulationRef.current) {
        return;
      }

      const simNodes = simulationRef.current.nodes;
      const simLinks = simulationRef.current.links;

      // Simple force-directed layout
      const k = Math.sqrt((canvas.width * canvas.height) / simNodes.length);
      const alpha = 0.1;

      // Repulsion between nodes
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const nodeA = simNodes[i];
          const nodeB = simNodes[j];
          const dx = (nodeB.x || 0) - (nodeA.x || 0);
          const dy = (nodeB.y || 0) - (nodeA.y || 0);
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (k * k) / distance;
          
          nodeA.vx = (nodeA.vx || 0) - (dx / distance) * force * alpha;
          nodeA.vy = (nodeA.vy || 0) - (dy / distance) * force * alpha;
          nodeB.vx = (nodeB.vx || 0) + (dx / distance) * force * alpha;
          nodeB.vy = (nodeB.vy || 0) + (dy / distance) * force * alpha;
        }
      }

      // Attraction along links
      for (const link of simLinks) {
        const source = typeof link.source === 'string' 
          ? simNodes.find(n => n.id === link.source)
          : link.source;
        const target = typeof link.target === 'string'
          ? simNodes.find(n => n.id === link.target)
          : link.target;

        if (!source || !target) {
          continue;
        }

        const dx = (target.x || 0) - (source.x || 0);
        const dy = (target.y || 0) - (source.y || 0);
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (distance * distance) / k;

        source.vx = (source.vx || 0) + (dx / distance) * force * alpha;
        source.vy = (source.vy || 0) + (dy / distance) * force * alpha;
        target.vx = (target.vx || 0) - (dx / distance) * force * alpha;
        target.vy = (target.vy || 0) - (dy / distance) * force * alpha;
      }

      // Update positions
      for (const node of simNodes) {
        node.x = (node.x || 0) + (node.vx || 0);
        node.y = (node.y || 0) + (node.vy || 0);
        node.vx = (node.vx || 0) * 0.9;
        node.vy = (node.vy || 0) * 0.9;

        // Keep nodes within bounds
        node.x = Math.max(50, Math.min(canvas.width - 50, node.x));
        node.y = Math.max(50, Math.min(canvas.height - 50, node.y));
      }

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw links
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      for (const link of simLinks) {
        const source = typeof link.source === 'string' 
          ? simNodes.find(n => n.id === link.source)
          : link.source;
        const target = typeof link.target === 'string'
          ? simNodes.find(n => n.id === link.target)
          : link.target;

        if (!source || !target) {
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(source.x || 0, source.y || 0);
        ctx.lineTo(target.x || 0, target.y || 0);
        ctx.stroke();

        // Draw relationship type label
        const midX = ((source.x || 0) + (target.x || 0)) / 2;
        const midY = ((source.y || 0) + (target.y || 0)) / 2;
        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.fillText(link.type, midX, midY);
      }

      // Draw nodes
      for (const node of simNodes) {
        // Color by label type (simple hash-based coloring)
        const label = node.label || 'Unknown';
        const hue = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, 15, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw node label
        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labelText = node.name || node.title || node.label || node.id;
        ctx.fillText(labelText, node.x || 0, (node.y || 0) + 30);
      }

      animationId = requestAnimationFrame(simulate);
      animationFrameRef.current = animationId;
    };

    simulate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [nodes, links]);

  if (nodes.length === 0) {
    return (
      <div className="graph-loading">
        <p>No graph data to display</p>
      </div>
    );
  }

  return (
    <div className="graph-renderer">
      <canvas ref={canvasRef} width={800} height={600} />
    </div>
  );
}

export default GraphRenderer;
