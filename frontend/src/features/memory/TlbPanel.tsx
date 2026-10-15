import React from 'react';
import { Cpu } from 'lucide-react';
import { TlbEntry, MemoryMetrics } from '../../bridge/schema';

export interface TlbPanelProps {
  entries: TlbEntry[];
  capacity: number;
  lastHit: boolean | null;
  activePage?: number | null;
  metrics?: MemoryMetrics | null;
  emptyMessage?: string;
}

export const TlbPanel: React.FC<TlbPanelProps> = ({
  entries,
  capacity = 4,
  lastHit = null,
  activePage = null,
  metrics = null,
  emptyMessage = 'TLB is empty'
}) => {
  if (capacity <= 0) {
    return (
      <div
        role="region"
        aria-label="TLB Panel"
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          fontStyle: 'italic',
          background: 'rgba(5, 8, 14, 0.4)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-subtle)'
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  // Construct slots based on capacity
  const slots: Array<TlbEntry | null> = Array.from({ length: capacity }, (_, i) => {
    return entries[i] ?? null;
  });

  return (
    <div
      role="region"
      aria-label="Translation Lookaside Buffer Panel"
      className="glass-panel"
      style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      {/* Header with Live Status Tag */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cpu size={16} color="var(--primary-cyan)" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
            TLB Cache (Fast-Path)
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastHit === true && (
            <span
              role="status"
              aria-label="TLB Hit"
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#fff',
                background: 'var(--accent-emerald)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              TLB HIT
            </span>
          )}
          {lastHit === false && (
            <span
              role="status"
              aria-label="TLB Miss"
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#fff',
                background: 'var(--accent-amber)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              TLB MISS
            </span>
          )}
          <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
            {entries.length}/{capacity} Slots
          </span>
        </div>
      </div>

      {/* TLB Slots Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${capacity}, 1fr)`, gap: 10 }}>
        {slots.map((entry, idx) => {
          const isSlotHit = entry !== null && activePage !== null && entry.page === activePage && lastHit === true;
          return (
            <div
              key={idx}
              role="article"
              aria-label={`TLB Slot ${idx}: ${entry ? `Page ${entry.page} to Frame ${entry.frame}` : 'Empty'}`}
              style={{
                background: isSlotHit
                  ? 'rgba(16, 185, 129, 0.15)'
                  : entry
                  ? 'rgba(255, 255, 255, 0.03)'
                  : 'rgba(0, 0, 0, 0.25)',
                border: isSlotHit
                  ? '1px solid var(--accent-emerald)'
                  : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 8px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <span style={{ fontSize: '0.65rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                Slot #{idx}
              </span>
              {entry ? (
                <>
                  <span className="mono-val" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-cyan)' }}>
                    P{entry.page} → F{entry.frame}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-subtle)' }}>
                    last: {entry.lastAccess}t
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontStyle: 'italic', padding: '6px 0' }}>
                  empty
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Quantitative TLB Metrics */}
      {metrics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 10
        }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 4, textAlign: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>TLB Hits</span>
            <p className="mono-val" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: 2 }}>
              {metrics.tlbHits}
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 4, textAlign: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>TLB Misses</span>
            <p className="mono-val" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: 2 }}>
              {metrics.tlbMisses}
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 4, textAlign: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Hit Rate</span>
            <p className="mono-val" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-cyan)', marginTop: 2 }}>
              {(metrics.tlbHitRate * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
