import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ShieldAlert, CheckCircle, RefreshCw, Info, Zap } from 'lucide-react';
import { SimEvent } from '../../bridge/schema';
import {
  replayRagState,
  GOLDEN_RAG_DEADLOCK_EVENTS,
  GOLDEN_RAG_RESOLVED_EVENTS,
  GOLDEN_RAG_COMPLEX_SAFE_EVENTS
} from '../../bridge/syncGoldenData';

interface RagGraphProps {
  customEvents?: SimEvent[];
}

export const RagGraph: React.FC<RagGraphProps> = ({ customEvents }) => {
  const [selectedScenario, setSelectedScenario] = useState<'deadlock' | 'resolved' | 'complex'>('deadlock');
  const [activeEvents, setActiveEvents] = useState<SimEvent[]>(
    customEvents || GOLDEN_RAG_DEADLOCK_EVENTS
  );
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Update events when scenario or customEvents changes
  useEffect(() => {
    if (customEvents) {
      setActiveEvents(customEvents);
      return;
    }
    if (selectedScenario === 'deadlock') {
      setActiveEvents(GOLDEN_RAG_DEADLOCK_EVENTS);
    } else if (selectedScenario === 'resolved') {
      setActiveEvents(GOLDEN_RAG_RESOLVED_EVENTS);
    } else {
      setActiveEvents(GOLDEN_RAG_COMPLEX_SAFE_EVENTS);
    }
  }, [selectedScenario, customEvents]);

  // Replay graph state from engine events (strictly no UI cycle detection)
  const graphState = React.useMemo(() => {
    return replayRagState(activeEvents);
  }, [activeEvents]);

  const { nodes, edges, deadlock } = graphState;

  // D3 Rendering
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 640;
    const height = 360;

    svg.selectAll('*').remove();

    // Definitions for markers (arrows)
    const defs = svg.append('defs');

    // Request arrow (dashed edge marker - cyan)
    defs.append('marker')
      .attr('id', 'arrow-request')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'var(--primary-cyan)');

    // Assignment arrow (solid edge marker - purple/emerald)
    defs.append('marker')
      .attr('id', 'arrow-assignment')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#a78bfa');

    // Deadlock cycle arrow (crimson)
    defs.append('marker')
      .attr('id', 'arrow-cycle')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'var(--accent-crimson)');

    // Compute node layout
    // Deterministic positions based on node counts or known topologies
    const nodeCoords = new Map<string, { x: number; y: number }>();

    if (nodes.length <= 4) {
      // Classic diamond layout: P1 (left), R1 (top), P2 (right), R2 (bottom)
      const centerX = width / 2;
      const centerY = height / 2;
      const spreadX = 180;
      const spreadY = 110;

      for (const node of nodes) {
        if (node.id === 'P1') nodeCoords.set('P1', { x: centerX - spreadX, y: centerY });
        else if (node.id === 'R1') nodeCoords.set('R1', { x: centerX, y: centerY - spreadY });
        else if (node.id === 'P2') nodeCoords.set('P2', { x: centerX + spreadX, y: centerY });
        else if (node.id === 'R2') nodeCoords.set('R2', { x: centerX, y: centerY + spreadY });
        else nodeCoords.set(node.id, { x: centerX, y: centerY });
      }
    } else {
      // Bipartite or circular layout for complex graphs
      const processes = nodes.filter(n => n.type === 'process');
      const resources = nodes.filter(n => n.type === 'resource');

      processes.forEach((p, i) => {
        const x = 140;
        const y = 80 + (i * (height - 160)) / Math.max(1, processes.length - 1);
        nodeCoords.set(p.id, { x, y });
      });

      resources.forEach((r, i) => {
        const x = width - 140;
        const y = 80 + (i * (height - 160)) / Math.max(1, resources.length - 1);
        nodeCoords.set(r.id, { x, y });
      });
    }

    const container = svg.append('g').attr('class', 'rag-container');

    // Render Edges
    const edgeGroup = container.append('g').attr('class', 'rag-edges');

    edges.forEach(edge => {
      const source = nodeCoords.get(edge.from);
      const target = nodeCoords.get(edge.to);
      if (!source || !target) return;

      const isCycle = edge.inCycle;
      const isRequest = edge.kind === 'REQUEST';

      let markerUrl = isCycle
        ? 'url(#arrow-cycle)'
        : isRequest
        ? 'url(#arrow-request)'
        : 'url(#arrow-assignment)';

      const strokeColor = isCycle
        ? 'var(--accent-crimson)'
        : isRequest
        ? 'var(--primary-cyan)'
        : '#a78bfa';

      const strokeWidth = isCycle ? 3.5 : 2;
      const strokeDash = isRequest ? '6,4' : 'none';

      const line = edgeGroup.append('line')
        .attr('x1', source.x)
        .attr('y1', source.y)
        .attr('x2', target.x)
        .attr('y2', target.y)
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-dasharray', strokeDash)
        .attr('marker-end', markerUrl)
        .attr('cursor', 'pointer')
        .style('transition', 'all 0.3s ease');

      // Click to inspect edge
      line.on('click', () => {
        setSelectedElement(`Edge: ${edge.from} → ${edge.to} (${edge.kind})${isCycle ? ' [CYCLE]' : ''}`);
      });

      // Hover glow
      line.on('mouseenter', function () {
        d3.select(this).attr('stroke-width', strokeWidth + 2);
      }).on('mouseleave', function () {
        d3.select(this).attr('stroke-width', strokeWidth);
      });
    });

    // Render Nodes
    const nodeGroup = container.append('g').attr('class', 'rag-nodes');

    nodes.forEach(node => {
      const pos = nodeCoords.get(node.id) || { x: width / 2, y: height / 2 };
      const isCycle = node.inCycle;
      const isProcess = node.type === 'process';

      const g = nodeGroup.append('g')
        .attr('transform', `translate(${pos.x}, ${pos.y})`)
        .attr('cursor', 'pointer')
        .on('click', () => {
          setSelectedElement(
            `${isProcess ? 'Process' : 'Resource'}: ${node.id} ${isCycle ? '(Part of Deadlock Cycle)' : '(Acyclic)'}`
          );
        });

      if (isProcess) {
        // Process Node: Circle
        g.append('circle')
          .attr('r', 26)
          .attr('fill', isCycle ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0, 242, 254, 0.15)')
          .attr('stroke', isCycle ? 'var(--accent-crimson)' : 'var(--primary-cyan)')
          .attr('stroke-width', isCycle ? 3 : 2)
          .style('filter', isCycle ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' : 'none')
          .style('transition', 'all 0.3s ease');

        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', '#ffffff')
          .attr('font-size', '13px')
          .attr('font-weight', '700')
          .text(node.label);
      } else {
        // Resource Node: Rounded Rectangle with instance indicator
        const w = 54;
        const h = 48;
        g.append('rect')
          .attr('x', -w / 2)
          .attr('y', -h / 2)
          .attr('width', w)
          .attr('height', h)
          .attr('rx', 8)
          .attr('fill', isCycle ? 'rgba(239, 68, 68, 0.25)' : 'rgba(139, 92, 246, 0.15)')
          .attr('stroke', isCycle ? 'var(--accent-crimson)' : 'var(--accent-purple)')
          .attr('stroke-width', isCycle ? 3 : 2)
          .style('filter', isCycle ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' : 'none')
          .style('transition', 'all 0.3s ease');

        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '-0.1em')
          .attr('fill', '#ffffff')
          .attr('font-size', '13px')
          .attr('font-weight', '700')
          .text(node.label);

        // Instance dots
        const instCount = node.instances || 1;
        const dotRadius = 3;
        for (let i = 0; i < instCount; ++i) {
          g.append('circle')
            .attr('cx', (i - (instCount - 1) / 2) * 10)
            .attr('cy', 14)
            .attr('r', dotRadius)
            .attr('fill', isCycle ? 'var(--accent-crimson)' : 'var(--accent-purple)');
        }
      }

      // Hover feedback
      g.on('mouseenter', function () {
        d3.select(this).style('transform', `translate(${pos.x}px, ${pos.y}px) scale(1.1)`);
      }).on('mouseleave', function () {
        d3.select(this).style('transform', `translate(${pos.x}px, ${pos.y}px) scale(1)`);
      });
    });

  }, [nodes, edges, deadlock]);

  return (
    <div
      className="glass-panel"
      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}
      role="region"
      aria-label="Resource Allocation Graph View"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === '1') setSelectedScenario('deadlock');
        if (e.key === '2') setSelectedScenario('resolved');
        if (e.key === '3') setSelectedScenario('complex');
      }}
    >
      {/* Header and Scenario Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} color="var(--primary-cyan)" />
            Resource Allocation Graph (RAG) View
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: 2 }}>
            Directed dependency graph of Processes and Resources. Cycles detected by the C++ engine are highlighted.
          </p>
        </div>

        {/* Keyboard accessible scenario switch */}
        <div style={{ display: 'flex', gap: 8 }} role="toolbar" aria-label="RAG Scenarios">
          <button
            onClick={() => setSelectedScenario('deadlock')}
            className={`btn-secondary ${selectedScenario === 'deadlock' ? 'btn-active' : ''}`}
            aria-pressed={selectedScenario === 'deadlock'}
            title="Press '1' on keyboard"
          >
            <ShieldAlert size={14} color="var(--accent-crimson)" />
            <span>Deadlock Cycle (P1 ↔ P2)</span>
          </button>
          <button
            onClick={() => setSelectedScenario('resolved')}
            className={`btn-secondary ${selectedScenario === 'resolved' ? 'btn-active' : ''}`}
            aria-pressed={selectedScenario === 'resolved'}
            title="Press '2' on keyboard"
          >
            <CheckCircle size={14} color="var(--accent-emerald)" />
            <span>Resolved / Acyclic</span>
          </button>
          <button
            onClick={() => setSelectedScenario('complex')}
            className={`btn-secondary ${selectedScenario === 'complex' ? 'btn-active' : ''}`}
            aria-pressed={selectedScenario === 'complex'}
            title="Press '3' on keyboard"
          >
            <RefreshCw size={14} />
            <span>Multi-Resource Hierarchy</span>
          </button>
        </div>
      </div>

      {/* Explicit Deadlock Status Banner */}
      {deadlock.hasDeadlock ? (
        <div
          data-testid="rag-deadlock-banner"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}
        >
          <ShieldAlert size={28} color="var(--accent-crimson)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-crimson)', letterSpacing: '0.04em' }}>
                DEADLOCK DETECTED
              </span>
              <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5' }}>
                {deadlock.cycleCount} Cycle{deadlock.cycleCount > 1 ? 's' : ''} Identified
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Active Deadlock Cycle:{' '}
              {deadlock.cycles.map((c, i) => (
                <span key={i} className="mono-val" style={{ color: '#fff', fontWeight: 700, marginLeft: 4 }}>
                  {c.join(' → ')}
                </span>
              ))}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: 2 }}>
              Circular wait detected by C++ engine event stream. No thread in this cycle can proceed.
            </p>
          </div>
        </div>
      ) : (
        <div
          data-testid="rag-no-deadlock-banner"
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}
        >
          <CheckCircle size={28} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-emerald)', letterSpacing: '0.04em' }}>
              NO DEADLOCK DETECTED
            </span>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Resource dependency graph is acyclic. All processes can acquire resources and terminate.
            </p>
          </div>
        </div>
      )}

      {/* SVG Canvas */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 12px',
        position: 'relative'
      }}>
        <svg
          ref={svgRef}
          width={640}
          height={360}
          viewBox="0 0 640 360"
          style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
        />

        {/* Legend */}
        <div style={{
          display: 'flex',
          gap: 20,
          marginTop: 12,
          padding: '8px 16px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--primary-cyan)', background: 'rgba(0, 242, 254, 0.2)' }} />
            <span>Process Node</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid var(--accent-purple)', background: 'rgba(139, 92, 246, 0.2)' }} />
            <span>Resource Node</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 18, height: 0, borderBottom: '2px dashed var(--primary-cyan)' }} />
            <span>Request Edge (P → R)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 18, height: 0, borderBottom: '2px solid #a78bfa' }} />
            <span>Assignment Edge (R → P)</span>
          </div>
          {deadlock.hasDeadlock && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, height: 0, borderBottom: '3px solid var(--accent-crimson)' }} />
              <span style={{ color: 'var(--accent-crimson)', fontWeight: 700 }}>Cycle Edge</span>
            </div>
          )}
        </div>
      </div>

      {/* Selected Element Inspector */}
      {selectedElement && (
        <div style={{
          fontSize: '0.75rem',
          padding: '8px 14px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <Info size={14} color="var(--primary-cyan)" />
          <span>Selected: <strong style={{ color: '#fff' }}>{selectedElement}</strong></span>
        </div>
      )}
    </div>
  );
};

export default RagGraph;
