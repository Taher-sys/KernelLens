import React from 'react';
import { Cpu, ListOrdered, Clock, CheckCircle2 } from 'lucide-react';
import { ReplayEngineState, ProcessSpec, SimulationResponse } from '../../bridge/schema';
import { CardSpotlight } from '../../components/ui/card-spotlight';

interface ProcessStateLanesProps {
  engineState: ReplayEngineState;
  processes: ProcessSpec[];
  currentTick: number;
  simResponse?: SimulationResponse | null;
}

export const ProcessStateLanes: React.FC<ProcessStateLanesProps> = ({
  engineState,
  processes,
  currentTick,
  simResponse
}) => {
  const runningPid = engineState.runningPid;
  const readyQueue = engineState.readyQueue;
  const waitingQueue = engineState.waitingQueue;
  const terminatedPids = engineState.terminatedPids;

  // Map metrics from simResponse if available
  const metricsMap = new Map<number, any>();
  if (simResponse && simResponse.metrics && Array.isArray(simResponse.metrics.perProcess)) {
    simResponse.metrics.perProcess.forEach((m) => {
      metricsMap.set(m.pid, m);
    });
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '10px',
        width: '100%'
      }}
      role="region"
      aria-label="Process State Queue Lanes"
    >
      {/* 1. RUNNING LANE */}
      <CardSpotlight
        className="glass-panel"
        style={{
          borderTop: '3px solid var(--state-running, #00A389)'
        }}
        contentStyle={{
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
        radius={280}
        revealColors={[[0, 163, 137], [0, 242, 254]]}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            <Cpu size={14} color="var(--state-running, #00A389)" />
            <span>RUNNING (CPU CORE 0)</span>
          </div>
          <span className="badge badge-emerald">
            {runningPid !== null ? '1 ACTIVE' : 'IDLE'}
          </span>
        </div>

        {runningPid !== null ? (
          <div
            style={{
              padding: '8px 10px',
              background: 'rgba(0, 163, 137, 0.08)',
              border: '1px solid rgba(0, 163, 137, 0.3)',
              borderRadius: 'var(--radius-sm, 2px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--state-running, #00A389)' }}>
                PROCESS P{runningPid}
              </span>
              <span style={{ color: 'var(--text-subtle)' }}>
                Pri: {processes.find((p) => p.pid === runningPid)?.basePriority ?? 0}
              </span>
            </div>
            <div style={{ color: 'var(--text-subtle)', fontSize: '10px' }}>
              Burst Remaining:{' '}
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                {engineState.processes[runningPid]?.currentBurstRemaining ?? 0}t
              </span>
            </div>
            <div style={{ color: 'var(--text-subtle)', fontSize: '10px' }}>
              State Since:{' '}
              <span style={{ color: 'var(--primary-cyan)' }}>
                Tick {engineState.processes[runningPid]?.lastStateChangeTick ?? currentTick}
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: 'var(--text-subtle)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-sm, 2px)'
            }}
          >
            [CPU Core Idle at Tick {currentTick}]
          </div>
        )}
      </CardSpotlight>

      {/* 2. READY QUEUE LANE */}
      <CardSpotlight
        className="glass-panel"
        style={{
          borderTop: '3px solid var(--state-ready, #2B6CB0)'
        }}
        contentStyle={{
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
        radius={280}
        revealColors={[[59, 130, 246], [139, 92, 246]]}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            <ListOrdered size={14} color="#38bdf8" />
            <span>READY RUNQUEUE</span>
          </div>
          <span className="badge badge-cyan">{readyQueue.length} QUEUED</span>
        </div>

        {readyQueue.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
            {readyQueue.map((pid, idx) => {
              const spec = processes.find((p) => p.pid === pid);
              return (
                <div
                  key={pid}
                  style={{
                    padding: '4px 8px',
                    background: 'var(--surface-subpanel)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm, 2px)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-subtle)', fontSize: '10px' }}>#{idx + 1}</span>
                    <span style={{ fontWeight: 700, color: '#38bdf8' }}>P{pid}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-subtle)' }}>
                    Pri: {spec?.basePriority ?? 0} | Arr: {spec?.arrivalTime ?? 0}t
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: 'var(--text-subtle)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-sm, 2px)'
            }}
          >
            [Runqueue Empty]
          </div>
        )}
      </CardSpotlight>

      {/* 3. WAITING / IO LANE */}
      <CardSpotlight
        className="glass-panel"
        style={{
          borderTop: '3px solid var(--state-waiting, #C05621)'
        }}
        contentStyle={{
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
        radius={280}
        revealColors={[[244, 157, 55], [194, 64, 42]]}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            <Clock size={14} color="#f59e0b" />
            <span>WAITING (I/O & SYNC)</span>
          </div>
          <span className="badge badge-amber">{waitingQueue.length} BLOCKED</span>
        </div>

        {waitingQueue.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
            {waitingQueue.map((pid) => (
              <div
                key={pid}
                style={{
                  padding: '4px 8px',
                  background: 'rgba(192, 86, 33, 0.1)',
                  border: '1px solid rgba(192, 86, 33, 0.3)',
                  borderRadius: 'var(--radius-sm, 2px)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px'
                }}
              >
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>P{pid}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-subtle)' }}>
                  Awaiting Device / Lock
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: 'var(--text-subtle)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-sm, 2px)'
            }}
          >
            [Zero Blocked Processes]
          </div>
        )}
      </CardSpotlight>

      {/* 4. TERMINATED LANE */}
      <CardSpotlight
        className="glass-panel"
        style={{
          borderTop: '3px solid #718096'
        }}
        contentStyle={{
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
        radius={280}
        revealColors={[[148, 163, 184], [100, 116, 139]]}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            <CheckCircle2 size={14} color="#718096" />
            <span>TERMINATED (PCB RECORD)</span>
          </div>
          <span className="badge badge-gray">{terminatedPids.length} / {processes.length}</span>
        </div>

        {terminatedPids.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
            {terminatedPids.map((pid) => {
              const m = metricsMap.get(pid);
              return (
                <div
                  key={pid}
                  style={{
                    padding: '4px 8px',
                    background: 'var(--surface-subpanel)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm, 2px)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px'
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#94a3b8' }}>P{pid}</span>
                  {m ? (
                    <span style={{ fontSize: '10px', color: 'var(--text-subtle)' }}>
                      Wait: {m.waitingTime}t | Turnaround: {m.turnaroundTime}t
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', color: '#10b981' }}>Done</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: 'var(--text-subtle)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-sm, 2px)'
            }}
          >
            [None Terminated Yet]
          </div>
        )}
      </CardSpotlight>
    </div>
  );
};
