import React, { useState } from 'react';
import { HardDrive, ArrowRight, Gauge } from 'lucide-react';
import { runDiskSimulation } from '../bridge/simulationBridge';
import { DiskPolicy } from '../types/schema';

const TEXTBOOK_REQS = [98, 183, 37, 122, 14, 124, 65, 67];

export const DiskVisualizer: React.FC = () => {
  const [policy, setPolicy] = useState<DiskPolicy>('SSTF');
  const [initialHead, setInitialHead] = useState(53);
  const [requests] = useState<number[]>(TEXTBOOK_REQS);
  const maxCylinder = 199;

  const simResult = React.useMemo(() => {
    return runDiskSimulation(requests, initialHead, policy, maxCylinder, 'UP');
  }, [requests, initialHead, policy, maxCylinder]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Configuration Bar */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Left: Interactive Head Traversal Route */}
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <HardDrive size={18} color="var(--primary-cyan)" />
              Disk Cylinder Trajectory & Route Plotter
            </h3>
            <span className="badge badge-cyan">{policy}</span>
          </div>

          {/* Service Sequence Route Cards */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', padding: '12px 0' }}>
            <div style={{
              background: 'rgba(79, 172, 254, 0.2)',
              border: '1px solid var(--border-glow)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-subtle)' }}>Start</span>
              <span className="mono-val" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-cyan)' }}>
                {initialHead}
              </span>
            </div>

            {simResult.serviceOrder.map((cyl, idx) => (
              <React.Fragment key={idx}>
                <ArrowRight size={14} color="var(--text-subtle)" />
                <div style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-subtle)' }}>Step #{idx + 1}</span>
                  <span className="mono-val" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {cyl}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* SVG Trajectory Graph */}
          <div style={{ width: '100%', height: 260, background: 'rgba(5, 8, 14, 0.6)', borderRadius: 'var(--radius-md)', padding: '20px 24px' }}>
            <svg width="100%" height="100%" viewBox="0 0 700 220">
              {/* Horizontal track axis */}
              <line x1={40} y1={20} x2={660} y2={20} stroke="rgba(255,255,255,0.15)" strokeWidth={2} />
              <text x={40} y={12} fill="var(--text-subtle)" fontSize="10" fontFamily="var(--font-mono)">Cylinder 0</text>
              <text x={660} y={12} fill="var(--text-subtle)" fontSize="10" fontFamily="var(--font-mono)" textAnchor="end">Cylinder 199</text>

              {/* Waypoints line */}
              {(() => {
                const points = [{ step: 0, cyl: initialHead }, ...simResult.serviceOrder.map((c, i) => ({ step: i + 1, cyl: c }))];
                const getX = (cyl: number) => 40 + (cyl / maxCylinder) * 620;
                const getY = (step: number) => 35 + (step / (points.length - 1)) * 160;

                const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.cyl)} ${getY(p.step)}`).join(' ');

                return (
                  <g>
                    <path d={pathD} fill="none" stroke="var(--primary-cyan)" strokeWidth={2.5} strokeLinejoin="round" />
                    {points.map((p, idx) => (
                      <g key={idx}>
                        <circle cx={getX(p.cyl)} cy={getY(p.step)} r={idx === 0 ? 6 : 4} fill={idx === 0 ? '#ff4b2b' : 'var(--primary-cyan)'} />
                        <text x={getX(p.cyl)} y={getY(p.step) - 7} fill="#fff" fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle">{p.cyl}</text>
                      </g>
                    ))}
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Right Column: Seek Distance Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Gauge size={18} color="var(--primary-cyan)" />
              Seek Performance
            </h3>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 18, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                Total Seek Distance
              </span>
              <p className="mono-val" style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary-cyan)', margin: '6px 0' }}>
                {simResult.totalSeekDistance}
              </p>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>cylinders traversed</span>
            </div>

            <div style={{ marginTop: 16, fontSize: '0.78rem', color: 'var(--text-subtle)', lineHeight: 1.5 }}>
              <p>Textbook baseline comparisons on [98, 183, 37, 122, 14, 124, 65, 67]:</p>
              <ul style={{ paddingLeft: 18, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li><strong>SSTF:</strong> 236 cylinders (Greedy optimal)</li>
                <li><strong>LOOK:</strong> 299 cylinders (Smooth sweep)</li>
                <li><strong>FCFS:</strong> 640 cylinders (Unoptimized order)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
