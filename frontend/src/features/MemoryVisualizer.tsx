import React, { useState } from 'react';
import { Layers, AlertTriangle } from 'lucide-react';
import { runMemorySimulation } from '../bridge/simulationBridge';
import { MemoryPolicy } from '../types/schema';

const BELADY_STRING = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
const TEXTBOOK_STRING = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];

export const MemoryVisualizer: React.FC = () => {
  const [policy, setPolicy] = useState<MemoryPolicy>('FIFO');
  const [numFrames, setNumFrames] = useState(3);
  const [referenceString, setReferenceString] = useState<number[]>(BELADY_STRING);
  const [preset, setPreset] = useState<'belady' | 'textbook'>('belady');

  const simResult = React.useMemo(() => {
    return runMemorySimulation(referenceString, numFrames, policy, 4);
  }, [referenceString, numFrames, policy]);

  // Comparative Belady run: calculate faults on 3 vs 4 frames under current policy
  const beladyComparison = React.useMemo(() => {
    if (preset !== 'belady') return null;
    const res3 = runMemorySimulation(BELADY_STRING, 3, policy, 0);
    const res4 = runMemorySimulation(BELADY_STRING, 4, policy, 0);
    return {
      faults3: res3.metrics.pageFaults,
      faults4: res4.metrics.pageFaults,
      isAnomaly: res4.metrics.pageFaults > res3.metrics.pageFaults
    };
  }, [preset, policy]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Configuration Header */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        {/* Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Reference String:</span>
          <button
            onClick={() => {
              setPreset('belady');
              setReferenceString(BELADY_STRING);
            }}
            className={`btn-secondary ${preset === 'belady' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            Belady Anomaly String
          </button>
          <button
            onClick={() => {
              setPreset('textbook');
              setReferenceString(TEXTBOOK_STRING);
            }}
            className={`btn-secondary ${preset === 'textbook' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            Silberschatz (20 Refs)
          </button>
        </div>

        {/* Policy Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Policy:</span>
          {(['FIFO', 'LRU', 'OPTIMAL', 'CLOCK'] as MemoryPolicy[]).map(pol => (
            <button
              key={pol}
              onClick={() => setPolicy(pol)}
              className={`btn-secondary ${policy === pol ? 'btn-active' : ''}`}
              style={{ fontSize: '0.78rem', padding: '5px 12px' }}
            >
              {pol}
            </button>
          ))}

          {/* Frame count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12, borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Frames:</span>
            {[3, 4, 5].map(f => (
              <button
                key={f}
                onClick={() => setNumFrames(f)}
                className={`btn-secondary ${numFrames === f ? 'btn-active' : ''}`}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Belady Anomaly Alert Banner */}
      {beladyComparison && beladyComparison.isAnomaly && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          <AlertTriangle color="var(--accent-crimson)" size={22} />
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fca5a5' }}>
              Belady’s Anomaly Detected under {policy}!
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              With 3 frames: <strong style={{ color: '#fff' }}>{beladyComparison.faults3} faults</strong>. With 4 frames: <strong style={{ color: '#fca5a5' }}>{beladyComparison.faults4} faults</strong>.
              Under FIFO, increasing physical memory capacity counter-intuitively causes more page faults!
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Reference Access Stream & Frames */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Left: Reference String Timeline */}
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={18} color="var(--primary-cyan)" />
            Page Access Sequence & Fault Timeline
          </h3>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 0' }}>
            {referenceString.map((page, idx) => {
              // Find if this step faulted
              const faultEvt = simResult.events.find(e => e.time === idx && e.type === 'page_fault');
              const isFault = !!faultEvt;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 44,
                    padding: '8px 4px',
                    borderRadius: 'var(--radius-sm)',
                    background: isFault ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    border: isFault ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)'
                  }}
                >
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-subtle)' }}>t={idx}</span>
                  <span className="mono-val" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {page}
                  </span>
                  {isFault ? (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-crimson)' }}>FAULT</span>
                  ) : (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>HIT</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Resident Physical Frames */}
          <div style={{ marginTop: 10 }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>
              Physical Frames Status (Final State)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numFrames}, 1fr)`, gap: 12 }}>
              {simResult.frames.map((frame, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Frame #{idx}</span>
                  <span className="mono-val" style={{ fontSize: '1.75rem', fontWeight: 800, color: frame.page !== null ? 'var(--primary-cyan)' : 'var(--text-subtle)' }}>
                    {frame.page !== null ? `Page ${frame.page}` : 'Empty'}
                  </span>
                  <div style={{ display: 'flex', gap: 10, fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    <span>Loaded: {frame.loadedAt}t</span>
                    <span>Used: {frame.lastUsedAt}t</span>
                    {policy === 'CLOCK' && <span>Ref: {frame.refBit ? '1' : '0'}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Metrics & TLB */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Paging Metrics */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 14 }}>Memory Metrics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Accesses:</span>
                <span className="mono-val" style={{ fontWeight: 700 }}>{simResult.metrics.totalAccesses}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Page Faults:</span>
                <span className="mono-val" style={{ fontWeight: 700, color: 'var(--accent-crimson)' }}>{simResult.metrics.pageFaults}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fault Rate:</span>
                <span className="mono-val" style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>{(simResult.metrics.faultRate * 100).toFixed(1)} %</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TLB Hits:</span>
                <span className="mono-val" style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{simResult.metrics.tlbHits}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TLB Hit Rate:</span>
                <span className="mono-val" style={{ fontWeight: 700, color: 'var(--primary-cyan)' }}>{(simResult.metrics.tlbHitRate * 100).toFixed(1)} %</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
