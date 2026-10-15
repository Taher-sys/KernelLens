import React, { useState } from 'react';
import {
  Database,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Split
} from 'lucide-react';
import {
  AllocatorPolicy,
  ContiguousAllocationResult
} from '../../bridge/schema';
import {
  GOLDEN_EXTERNAL_FRAG_SCENARIO,
  GOLDEN_OUT_OF_MEMORY_SCENARIO,
  GOLDEN_FIT_COMPARISONS,
  AllocatorScenario
} from '../../bridge/allocatorGoldenData';

interface AllocationBlocksProps {
  initialScenario?: AllocatorScenario;
}

export const AllocationBlocks: React.FC<AllocationBlocksProps> = ({
  initialScenario = GOLDEN_EXTERNAL_FRAG_SCENARIO
}) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>(initialScenario.id);
  const [policy, setPolicy] = useState<AllocatorPolicy>('FIRST_FIT');

  // Active scenario data from verified engine benchmark
  const activeScenario: AllocatorScenario = React.useMemo(() => {
    if (activeScenarioId === 'external-frag') {
      return GOLDEN_EXTERNAL_FRAG_SCENARIO;
    }
    if (activeScenarioId === 'out-of-memory') {
      return GOLDEN_OUT_OF_MEMORY_SCENARIO;
    }
    return GOLDEN_FIT_COMPARISONS[policy] || GOLDEN_FIT_COMPARISONS.FIRST_FIT;
  }, [activeScenarioId, policy]);

  const [hasEvaluated, setHasEvaluated] = useState<boolean>(true);

  // Switch scenario
  const handleSelectScenario = (scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    setHasEvaluated(true);
  };

  const currentBlocks = hasEvaluated
    ? activeScenario.resultBlocks
    : activeScenario.initialBlocks;

  const totalCapacity = activeScenario.totalCapacity;
  const totalFree = currentBlocks
    .filter(b => !b.allocated)
    .reduce((acc, b) => acc + b.size, 0);

  const largestHole = currentBlocks
    .filter(b => !b.allocated)
    .reduce((max, b) => Math.max(max, b.size), 0);

  const result: ContiguousAllocationResult = activeScenario.expectedResult;

  return (
    <div
      className="glass-panel"
      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}
      role="region"
      aria-label="Contiguous Memory Allocation Blocks"
    >
      {/* Header and Scenario Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} color="var(--primary-cyan)" />
            Contiguous Memory Allocation & Fragmentation Lab
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: 2 }}>
            Simulate First-Fit, Best-Fit, Worst-Fit and external fragmentation using C++ engine response data.
          </p>
        </div>

        {/* Preset Benchmark Scenarios */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="toolbar" aria-label="Allocation Scenarios">
          <button
            onClick={() => handleSelectScenario('external-frag')}
            className={`btn-secondary ${activeScenarioId === 'external-frag' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.75rem' }}
          >
            <AlertTriangle size={13} color="var(--accent-amber)" />
            <span>External Fragmentation (Fail)</span>
          </button>
          <button
            onClick={() => handleSelectScenario('out-of-memory')}
            className={`btn-secondary ${activeScenarioId === 'out-of-memory' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.75rem' }}
          >
            <XCircle size={13} color="var(--accent-crimson)" />
            <span>Out of Memory (Fail)</span>
          </button>
          <button
            onClick={() => handleSelectScenario('compare-fit')}
            className={`btn-secondary ${activeScenarioId === 'compare-fit' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.75rem' }}
          >
            <Split size={13} color="var(--primary-cyan)" />
            <span>Fit Policy Comparison</span>
          </button>
        </div>
      </div>

      {/* Fit Policy Selector if comparing policies */}
      {activeScenarioId === 'compare-fit' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', padding: '8px 14px', borderRadius: 'var(--radius-sm)' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: 600 }}>Select Algorithm:</span>
          {(['FIRST_FIT', 'BEST_FIT', 'WORST_FIT'] as AllocatorPolicy[]).map(p => (
            <button
              key={p}
              onClick={() => setPolicy(p)}
              className={`btn-secondary ${policy === p ? 'btn-active' : ''}`}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              {p.replace('_', ' ')}
            </button>
          ))}
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: 8 }}>
            {policy === 'FIRST_FIT' && 'Takes first sufficient hole (500 KB).'}
            {policy === 'BEST_FIT' && 'Takes smallest sufficient hole (300 KB, leaves 50 KB slack).'}
            {policy === 'WORST_FIT' && 'Takes largest hole (500 KB, leaves 250 KB slack).'}
          </span>
        </div>
      )}

      {/* Memory Capacity Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            Physical Memory Layout (Total Capacity: {totalCapacity} KB)
          </span>
          <div style={{ display: 'flex', gap: 14, fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-subtle)' }}>
              Total Free: <strong style={{ color: 'var(--accent-emerald)' }}>{totalFree} KB</strong>
            </span>
            <span style={{ color: 'var(--text-subtle)' }}>
              Largest Hole: <strong style={{ color: 'var(--primary-cyan)' }}>{largestHole} KB</strong>
            </span>
          </div>
        </div>

        {/* Visual Memory Strip */}
        <div style={{
          height: 52,
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {currentBlocks.map((block) => {
            const widthPct = (block.size / totalCapacity) * 100;
            const isAllocated = block.allocated;

            return (
              <div
                key={block.id}
                style={{
                  width: `${widthPct}%`,
                  height: '100%',
                  background: isAllocated
                    ? 'linear-gradient(180deg, rgba(79, 172, 254, 0.35) 0%, rgba(0, 242, 254, 0.2) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  borderRight: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px 4px',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title={`Block ${block.id}: ${block.start}..${block.start + block.size} KB (${isAllocated ? `Allocated P${block.owner}` : 'Free Hole'})`}
              >
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: isAllocated ? 'var(--primary-cyan)' : 'var(--text-subtle)',
                  whiteSpace: 'nowrap'
                }}>
                  {isAllocated ? `P${block.owner}` : 'FREE'}
                </span>
                <span className="mono-val" style={{
                  fontSize: '0.65rem',
                  color: isAllocated ? '#fff' : 'var(--text-muted)',
                  whiteSpace: 'nowrap'
                }}>
                  {block.size} KB
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Allocation Evaluation Details / Failure Display */}
      {result && (
        <div
          data-testid={result.success ? 'allocation-success-banner' : 'allocation-failed-banner'}
          style={{
            background: result.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.12)',
            border: result.success ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {result.success ? (
                <CheckCircle size={20} color="var(--accent-emerald)" />
              ) : (
                <XCircle size={20} color="var(--accent-crimson)" />
              )}
              <span style={{
                fontSize: '0.9rem',
                fontWeight: 800,
                color: result.success ? 'var(--accent-emerald)' : 'var(--accent-crimson)',
                letterSpacing: '0.04em'
              }}>
                {result.success ? 'ALLOCATION SUCCEEDED' : 'ALLOCATION FAILED'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, fontSize: '0.75rem' }}>
              <span>Target: <strong style={{ color: '#fff' }}>P{activeScenario.requestPid}</strong></span>
              <span>Requested: <strong style={{ color: '#fff' }}>{activeScenario.requestBytes} KB</strong></span>
              <span>Policy: <strong style={{ color: 'var(--primary-cyan)' }}>{activeScenario.policy}</strong></span>
            </div>
          </div>

          <p style={{ fontSize: '0.82rem', color: result.success ? '#6ee7b7' : '#fca5a5', lineHeight: 1.4 }}>
            {result.reason}
          </p>

          {/* If failed due to external fragmentation, show detailed diagnostic breakdown */}
          {!result.success && result.externalFragmentation > 0 && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
              fontSize: '0.75rem'
            }}>
              <div>
                <span style={{ color: 'var(--text-subtle)', display: 'block' }}>Total Free Memory:</span>
                <span className="mono-val" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
                  {totalFree} KB
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-subtle)', display: 'block' }}>Largest Contiguous Hole:</span>
                <span className="mono-val" style={{ color: 'var(--accent-crimson)', fontWeight: 700 }}>
                  {largestHole} KB
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-subtle)', display: 'block' }}>Requested Allocation:</span>
                <span className="mono-val" style={{ color: '#fff', fontWeight: 700 }}>
                  {activeScenario.requestBytes} KB
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-subtle)', display: 'block' }}>External Fragmentation:</span>
                <span className="mono-val" style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>
                  {result.externalFragmentation} KB
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Memory Blocks Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          Detailed Memory Segments Table
        </h4>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-subtle)' }}>
                <th style={{ padding: '8px 12px' }}>Block ID</th>
                <th style={{ padding: '8px 12px' }}>Start Address</th>
                <th style={{ padding: '8px 12px' }}>End Address</th>
                <th style={{ padding: '8px 12px' }}>Size</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 12px' }}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {currentBlocks.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td className="mono-val" style={{ padding: '8px 12px' }}>#{b.id}</td>
                  <td className="mono-val" style={{ padding: '8px 12px' }}>{b.start} KB</td>
                  <td className="mono-val" style={{ padding: '8px 12px' }}>{b.start + b.size} KB</td>
                  <td className="mono-val" style={{ padding: '8px 12px', fontWeight: 700 }}>{b.size} KB</td>
                  <td style={{ padding: '8px 12px' }}>
                    {b.allocated ? (
                      <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>Allocated</span>
                    ) : (
                      <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-subtle)' }}>
                        Free Hole
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: b.owner ? 'var(--primary-cyan)' : 'var(--text-subtle)' }}>
                    {b.owner ? `Process P${b.owner}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllocationBlocks;
