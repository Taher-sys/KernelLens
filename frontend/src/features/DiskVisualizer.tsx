import React, { useState } from 'react';
import { Gauge } from 'lucide-react';
import { runDiskSimulation } from '../bridge/simulationBridge';
import { DiskPolicy } from '../types/schema';
import { DiskHeadChart } from './disk/DiskHeadChart';

const TEXTBOOK_REQS = [98, 183, 37, 122, 14, 124, 65, 67];

export const DiskVisualizer: React.FC = () => {
  const [policy, setPolicy] = useState<DiskPolicy>('SSTF');
  const [initialHead, setInitialHead] = useState(53);
  const [requests, setRequests] = useState<number[]>(TEXTBOOK_REQS);
  const maxCylinder = 199;

  const simResult = React.useMemo(() => {
    if (requests.length === 0) return null;
    return runDiskSimulation(requests, initialHead, policy, maxCylinder, 'UP');
  }, [requests, initialHead, policy, maxCylinder]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Configuration Bar */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Workload:</span>
          <button
            onClick={() => setRequests(TEXTBOOK_REQS)}
            className={`btn-secondary ${requests.length > 0 ? 'btn-active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            Silberschatz (8 Reqs)
          </button>
          <button
            onClick={() => setRequests([])}
            className={`btn-secondary ${requests.length === 0 ? 'btn-active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            Unloaded (Empty)
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Algorithm:</span>
          {(['FCFS', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK', 'C-LOOK'] as DiskPolicy[]).map(pol => (
            <button
              key={pol}
              onClick={() => setPolicy(pol)}
              className={`btn-secondary ${policy === pol ? 'btn-active' : ''}`}
              style={{ fontSize: '0.78rem', padding: '5px 12px' }}
            >
              {pol}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Initial Head:</span>
          {[0, 50, 53, 100, 150].map(h => (
            <button
              key={h}
              onClick={() => setInitialHead(h)}
              className={`btn-secondary ${initialHead === h ? 'btn-active' : ''}`}
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout */}
      {!simResult || requests.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
          No simulation is loaded.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          {/* Left: D3 Interactive Head Traversal Route & Cumulative Chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <DiskHeadChart
              requests={requests}
              initialHead={initialHead}
              policy={policy}
              maxCylinder={maxCylinder}
              direction="UP"
              simResult={simResult}
            />
          </div>

          {/* Right: Metrics & Seek Analysis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="glass-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Gauge size={16} color="var(--primary-cyan)" />
                Mechanical Seek Metrics
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Total Seek Cylinders</span>
                  <p className="mono-val" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: 4 }}>
                    {simResult.totalSeekDistance} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>cyl</span>
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Average Seek Distance</span>
                  <p className="mono-val" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-cyan)', marginTop: 4 }}>
                    {(simResult.totalSeekDistance / Math.max(1, requests.length)).toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>cyl/req</span>
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Requests Serviced</span>
                  <p className="mono-val" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                    {requests.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
