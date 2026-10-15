import React from 'react';
import { AlertCircle } from 'lucide-react';
import { FrameState } from '../../bridge/schema';

export interface FrameGridProps {
  frames: FrameState[];
  currentTick?: number;
  isPageFault?: boolean;
  evictedPage?: number | null;
  targetPage?: number | null;
  targetFrame?: number | null;
  emptyMessage?: string;
}

export const FrameGrid: React.FC<FrameGridProps> = ({
  frames,
  currentTick = 0,
  isPageFault = false,
  evictedPage = null,
  targetPage = null,
  targetFrame = null,
  emptyMessage = 'No frames loaded'
}) => {
  if (!frames || frames.length === 0) {
    return (
      <div
        role="region"
        aria-label="Physical Frames Status"
        style={{
          padding: '40px 20px',
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

  return (
    <div
      role="region"
      aria-label="Physical Memory Frames"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {/* Accessible Page Fault Alert Announcement */}
      {isPageFault && targetPage !== null && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`Page Fault: Page ${targetPage} loaded into Frame ${targetFrame ?? 0}${evictedPage !== null ? `, evicting Page ${evictedPage}` : ''}`}
          style={{
            background: 'rgba(239, 68, 68, 0.16)',
            border: '2px solid #ef4444',
            borderRadius: 'var(--radius-md)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 0 16px rgba(239, 68, 68, 0.25)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={20} color="#ef4444" aria-hidden="true" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fca5a5' }}>
              PAGE FAULT DETECTED: Page P{targetPage} not resident in memory
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {evictedPage !== null ? (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#fff',
                background: '#dc2626',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)'
              }}>
                Evicted: P{evictedPage}
              </span>
            ) : (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#fff',
                background: 'var(--accent-emerald)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)'
              }}>
                Free Frame Allocated
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Tick {currentTick}
            </span>
          </div>
        </div>
      )}

      {/* Frame Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(170px, 1fr))`,
          gap: 14
        }}
      >
        {frames.map(frame => {
          const isTarget = targetFrame === frame.frameId;
          const isFaultTarget = isPageFault && isTarget;
          const isHitTarget = !isPageFault && isTarget && frame.page !== null;
          const isVictim = frame.isVictim || (isPageFault && isTarget && evictedPage !== null);

          // Card boundary styling based on access state
          let borderStyle = '1px solid var(--border-subtle)';
          let bgGradient = 'rgba(255, 255, 255, 0.02)';
          let glowShadow = 'none';

          if (isFaultTarget) {
            borderStyle = '2px solid #ef4444';
            bgGradient = 'rgba(239, 68, 68, 0.12)';
            glowShadow = '0 0 14px rgba(239, 68, 68, 0.3)';
          } else if (isHitTarget) {
            borderStyle = '2px solid var(--accent-emerald)';
            bgGradient = 'rgba(16, 185, 129, 0.1)';
            glowShadow = '0 0 14px rgba(16, 185, 129, 0.25)';
          }

          return (
            <div
              key={frame.frameId}
              role="article"
              aria-label={`Frame ${frame.frameId}: ${frame.page !== null ? `Page ${frame.page}` : 'Empty'}`}
              style={{
                border: borderStyle,
                borderRadius: 'var(--radius-md)',
                background: bgGradient,
                boxShadow: glowShadow,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              {/* Header: Frame Number and Accessible State Pill */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-subtle)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}>
                  Frame #{frame.frameId}
                </span>

                {isFaultTarget && (
                  <span
                    role="status"
                    aria-label="Fault"
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      background: '#ef4444',
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      letterSpacing: '0.03em'
                    }}
                  >
                    FAULT
                  </span>
                )}
                {isVictim && !isFaultTarget && (
                  <span
                    role="status"
                    aria-label="Victim Frame"
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      background: '#b91c1c',
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    VICTIM
                  </span>
                )}
                {isHitTarget && (
                  <span
                    role="status"
                    aria-label="Hit"
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      background: 'var(--accent-emerald)',
                      color: '#070a12',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      letterSpacing: '0.03em'
                    }}
                  >
                    HIT
                  </span>
                )}
                {!isTarget && frame.page !== null && (
                  <span style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-subtle)',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    RESIDENT
                  </span>
                )}
                {frame.page === null && (
                  <span style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-subtle)',
                    fontStyle: 'italic'
                  }}>
                    FREE
                  </span>
                )}
              </div>

              {/* Main Page Identifier */}
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                {frame.page !== null ? (
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '1.9rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: isFaultTarget ? '#fca5a5' : isHitTarget ? 'var(--accent-emerald)' : 'var(--primary-cyan)',
                      lineHeight: 1
                    }}>
                      P{frame.page}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: 4 }}>
                      Virtual Page {frame.page}
                    </span>
                  </div>
                ) : (
                  <div style={{ padding: '8px 0', color: 'var(--text-subtle)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    [Empty Frame]
                  </div>
                )}
              </div>

              {/* Frame Metadata Footer */}
              <div style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 8,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: 'var(--text-subtle)',
                fontFamily: 'var(--font-mono)'
              }}>
                <span>Loaded: {frame.loadedAt}t</span>
                <span>Used: {frame.lastUsedAt}t</span>
                {frame.referenceBit !== undefined && (
                  <span title="Reference Bit for Clock Algorithm">
                    Ref: {frame.referenceBit ? '1' : '0'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
