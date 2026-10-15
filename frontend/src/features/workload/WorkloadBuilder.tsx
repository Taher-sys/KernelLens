import React, { useState } from 'react';
import { Plus, Trash2, Play, Sliders, ChevronDown, ChevronRight } from 'lucide-react';
import { ProcessSpec, CpuPolicy } from '../../bridge/schema';
import { SUPPORTED_CPU_POLICIES } from '../../bridge/engineBridge';

// Textbook Scenario Presets
export const WORKLOAD_PRESETS: { name: string; description: string; policy: CpuPolicy; quantum: number; processes: ProcessSpec[] }[] = [
  {
    name: 'Convoy Effect (Silberschatz)',
    description: 'P1 with 24t burst dominates CPU; P2 and P3 wait 24t in FCFS. Demonstrates convoy penalty.',
    policy: 'ROUND_ROBIN',
    quantum: 3,
    processes: [
      { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 24 }], basePriority: 0, niceValue: 0 },
      { pid: 2, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 },
      { pid: 3, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 }
    ]
  },
  {
    name: 'Shortest Job First Benchmark',
    description: 'Staggered arrivals with short bursts minimizing average turnaround time.',
    policy: 'SJF',
    quantum: 3,
    processes: [
      { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 6 }], basePriority: 0, niceValue: 0 },
      { pid: 2, arrivalTime: 1, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 0, niceValue: 0 },
      { pid: 3, arrivalTime: 2, bursts: [{ kind: 'CPU', duration: 8 }], basePriority: 0, niceValue: 0 },
      { pid: 4, arrivalTime: 3, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 }
    ]
  },
  {
    name: 'Priority Starvation & Aging',
    description: 'Long low-priority task (P1) starved by stream of high-priority tasks (P2-P5) unless aging is enabled.',
    policy: 'PRIORITY',
    quantum: 3,
    processes: [
      { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 20 }], basePriority: 10, niceValue: 0 },
      { pid: 2, arrivalTime: 1, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: 0 },
      { pid: 3, arrivalTime: 5, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: 0 },
      { pid: 4, arrivalTime: 9, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: 0 },
      { pid: 5, arrivalTime: 13, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: 0 }
    ]
  },
  {
    name: 'Interactive Mixed (CPU + I/O Bursts)',
    description: 'Processes interleaving computation with asynchronous I/O completion.',
    policy: 'ROUND_ROBIN',
    quantum: 3,
    processes: [
      {
        pid: 1,
        arrivalTime: 0,
        bursts: [{ kind: 'CPU', duration: 4 }, { kind: 'IO', duration: 3 }, { kind: 'CPU', duration: 4 }],
        basePriority: 1,
        niceValue: 0
      },
      {
        pid: 2,
        arrivalTime: 2,
        bursts: [{ kind: 'CPU', duration: 3 }, { kind: 'IO', duration: 5 }, { kind: 'CPU', duration: 2 }],
        basePriority: 2,
        niceValue: 0
      },
      {
        pid: 3,
        arrivalTime: 4,
        bursts: [{ kind: 'CPU', duration: 6 }, { kind: 'IO', duration: 2 }, { kind: 'CPU', duration: 1 }],
        basePriority: 3,
        niceValue: 0
      }
    ]
  },
  {
    name: 'Multi-Level Feedback Queue (MLFQ)',
    description: 'CPU-intensive tasks demoted to lower-priority queues; interactive tasks stay in top queues.',
    policy: 'MLFQ',
    quantum: 2,
    processes: [
      { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 16 }], basePriority: 0, niceValue: 0 },
      { pid: 2, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 2 }, { kind: 'IO', duration: 3 }, { kind: 'CPU', duration: 2 }], basePriority: 0, niceValue: 0 },
      { pid: 3, arrivalTime: 3, bursts: [{ kind: 'CPU', duration: 1 }], basePriority: 0, niceValue: 0 }
    ]
  }
];

interface WorkloadBuilderProps {
  workload: ProcessSpec[];
  onChangeWorkload: (newWorkload: ProcessSpec[], presetName?: string) => void;
  onRunSimulation: () => void;
  selectedPolicy: CpuPolicy;
  onChangePolicy: (policy: CpuPolicy) => void;
  quantum: number;
  onChangeQuantum: (quantum: number) => void;
  preemptive: boolean;
  onChangePreemptive: (preemptive: boolean) => void;
  aging: number;
  onChangeAging: (aging: number) => void;
  contextSwitchCost: number;
  onChangeContextSwitchCost: (cost: number) => void;
  isExecuting?: boolean;
}

export const WorkloadBuilder: React.FC<WorkloadBuilderProps> = ({
  workload,
  onChangeWorkload,
  onRunSimulation,
  selectedPolicy,
  onChangePolicy,
  quantum,
  onChangeQuantum,
  preemptive,
  onChangePreemptive,
  aging,
  onChangeAging,
  contextSwitchCost,
  onChangeContextSwitchCost,
  isExecuting = false
}) => {
  const [expandedPid, setExpandedPid] = useState<number | null>(null);

  // Apply a preset
  const handleSelectPreset = (preset: typeof WORKLOAD_PRESETS[0]) => {
    onChangePolicy(preset.policy);
    onChangeQuantum(preset.quantum);
    onChangeWorkload(JSON.parse(JSON.stringify(preset.processes)), preset.name);
  };

  // Add a new process
  const handleAddProcess = () => {
    const nextPid = workload.length > 0 ? Math.max(...workload.map((p) => p.pid)) + 1 : 1;
    const newProcess: ProcessSpec = {
      pid: nextPid,
      arrivalTime: 0,
      bursts: [{ kind: 'CPU', duration: 4 }],
      basePriority: 0,
      niceValue: 0
    };
    onChangeWorkload([...workload, newProcess]);
    setExpandedPid(nextPid);
  };

  // Remove a process
  const handleRemoveProcess = (pid: number) => {
    onChangeWorkload(workload.filter((p) => p.pid !== pid));
  };

  // Update process fields
  const handleUpdateProcess = (pid: number, patch: Partial<ProcessSpec>) => {
    onChangeWorkload(
      workload.map((p) => (p.pid === pid ? { ...p, ...patch } : p))
    );
  };

  // Add burst segment to process
  const handleAddBurst = (pid: number, kind: 'CPU' | 'IO') => {
    onChangeWorkload(
      workload.map((p) => {
        if (p.pid === pid) {
          return {
            ...p,
            bursts: [...p.bursts, { kind, duration: kind === 'CPU' ? 4 : 2 }]
          };
        }
        return p;
      })
    );
  };

  // Remove burst segment
  const handleRemoveBurst = (pid: number, burstIndex: number) => {
    onChangeWorkload(
      workload.map((p) => {
        if (p.pid === pid && p.bursts.length > 1) {
          const nextBursts = [...p.bursts];
          nextBursts.splice(burstIndex, 1);
          return { ...p, bursts: nextBursts };
        }
        return p;
      })
    );
  };

  // Update burst duration
  const handleUpdateBurstDuration = (pid: number, burstIndex: number, duration: number) => {
    onChangeWorkload(
      workload.map((p) => {
        if (p.pid === pid) {
          const nextBursts = [...p.bursts];
          nextBursts[burstIndex] = {
            ...nextBursts[burstIndex],
            duration: Math.max(1, duration)
          };
          return { ...p, bursts: nextBursts };
        }
        return p;
      })
    );
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxHeight: '100%',
        overflowY: 'auto'
      }}
      role="region"
      aria-label="Workload Builder & Simulation Dispatcher"
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sliders size={14} color="var(--primary-cyan)" />
          <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            WORKLOAD BUILDER
          </span>
        </div>
        <span className="badge badge-cyan">{workload.length} PROCS</span>
      </div>

      {/* Preset Scenarios Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
          TEXTBOOK PRESET SCENARIOS:
        </label>
        <select
          onChange={(e) => {
            const found = WORKLOAD_PRESETS.find((p) => p.name === e.target.value);
            if (found) handleSelectPreset(found);
          }}
          defaultValue=""
          style={{
            background: 'var(--surface-subpanel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-main)',
            fontSize: '11px',
            fontFamily: 'var(--font-sans)',
            padding: '5px 8px',
            cursor: 'pointer'
          }}
          aria-label="Select Textbook Workload Preset"
        >
          <option value="" disabled>-- Load a Textbook Scenario --</option>
          {WORKLOAD_PRESETS.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name} ({preset.policy})
            </option>
          ))}
        </select>
      </div>

      {/* Algorithm Configuration Parameters */}
      <div
        style={{
          background: 'var(--surface-subpanel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--primary-cyan)' }}>
          SCHEDULING ALGORITHM:
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-subtle)', display: 'block', marginBottom: '2px' }}>
              Policy:
            </label>
            <select
              value={selectedPolicy}
              onChange={(e) => onChangePolicy(e.target.value as CpuPolicy)}
              style={{
                width: '100%',
                background: 'var(--surface-canvas)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-main)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                padding: '4px'
              }}
              aria-label="CPU Scheduling Algorithm Policy"
            >
              {SUPPORTED_CPU_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {(selectedPolicy === 'ROUND_ROBIN' || selectedPolicy === 'MLFQ' || selectedPolicy === 'CFS_LIKE') && (
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-subtle)', display: 'block', marginBottom: '2px' }}>
                Quantum:
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={quantum}
                onChange={(e) => onChangeQuantum(Math.max(1, Number(e.target.value)))}
                style={{
                  width: '100%',
                  background: 'var(--surface-canvas)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '4px'
                }}
                aria-label="Quantum Time Slice in ticks"
              />
            </div>
          )}
        </div>

        {selectedPolicy === 'PRIORITY' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-subtle)' }}>Preemptive Priority:</label>
            <input
              type="checkbox"
              checked={preemptive}
              onChange={(e) => onChangePreemptive(e.target.checked)}
              style={{ accentColor: 'var(--primary-cyan)' }}
              aria-label="Preemptive Priority Toggle"
            />
          </div>
        )}

        {selectedPolicy === 'PRIORITY' && (
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-subtle)', display: 'block', marginBottom: '2px' }}>
              Aging Interval (0 = disabled):
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={aging}
              onChange={(e) => onChangeAging(Math.max(0, Number(e.target.value)))}
              style={{
                width: '100%',
                background: 'var(--surface-canvas)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-main)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                padding: '4px'
              }}
              aria-label="Aging tick interval"
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-subtle)' }}>Context Switch Cost (ticks):</label>
          <input
            type="number"
            min={0}
            max={10}
            value={contextSwitchCost}
            onChange={(e) => onChangeContextSwitchCost(Math.max(0, Number(e.target.value)))}
            style={{
              width: '60px',
              background: 'var(--surface-canvas)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-main)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 4px',
              textAlign: 'right'
            }}
            aria-label="Context switch penalty in ticks"
          />
        </div>
      </div>

      {/* Process Specification List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
            PROCESSES:
          </span>
          <button
            onClick={handleAddProcess}
            className="btn-secondary"
            style={{ padding: '2px 6px', fontSize: '10px' }}
            title="Add Process"
            aria-label="Add Process to Workload"
          >
            <Plus size={11} />
            <span>Add Proc</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
          {workload.map((p) => {
            const isExpanded = expandedPid === p.pid;
            const totalCpuBurst = p.bursts
              .filter((b) => b.kind === 'CPU')
              .reduce((sum, b) => sum + b.duration, 0);

            return (
              <div
                key={p.pid}
                style={{
                  background: 'var(--surface-subpanel)',
                  border: `1px solid ${isExpanded ? 'var(--primary-cyan)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                {/* Process Summary Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => setExpandedPid(isExpanded ? null : p.pid)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700
                    }}
                  >
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span>P{p.pid}</span>
                    <span style={{ color: 'var(--text-subtle)', fontWeight: 400, fontSize: '10px' }}>
                      (Arr: {p.arrivalTime}t | CPU: {totalCpuBurst}t | Pri: {p.basePriority})
                    </span>
                  </button>

                  <button
                    onClick={() => handleRemoveProcess(p.pid)}
                    disabled={workload.length <= 1}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: workload.length <= 1 ? 'var(--text-subtle)' : '#ef4444',
                      cursor: workload.length <= 1 ? 'not-allowed' : 'pointer',
                      padding: '2px'
                    }}
                    title="Remove Process"
                    aria-label={`Remove Process P${p.pid}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Expanded Process Burst Editor */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: '4px',
                      paddingTop: '6px',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div>
                        <label style={{ color: 'var(--text-subtle)', display: 'block' }}>Arrival Tick:</label>
                        <input
                          type="number"
                          min={0}
                          value={p.arrivalTime}
                          onChange={(e) => handleUpdateProcess(p.pid, { arrivalTime: Math.max(0, Number(e.target.value)) })}
                          style={{
                            width: '100%',
                            background: 'var(--surface-canvas)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-main)',
                            padding: '2px 4px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ color: 'var(--text-subtle)', display: 'block' }}>Priority:</label>
                        <input
                          type="number"
                          min={0}
                          value={p.basePriority}
                          onChange={(e) => handleUpdateProcess(p.pid, { basePriority: Number(e.target.value) })}
                          style={{
                            width: '100%',
                            background: 'var(--surface-canvas)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-main)',
                            padding: '2px 4px'
                          }}
                        />
                      </div>
                    </div>

                    {/* Burst Sequence */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>Bursts Sequence:</span>
                      {p.bursts.map((b, bIdx) => (
                        <div
                          key={bIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--surface-canvas)',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          <span
                            style={{
                              color: b.kind === 'CPU' ? 'var(--state-running, #00a389)' : '#f59e0b',
                              fontWeight: 700
                            }}
                          >
                            {b.kind} Burst
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={b.duration}
                              onChange={(e) => handleUpdateBurstDuration(p.pid, bIdx, Number(e.target.value))}
                              style={{
                                width: '45px',
                                background: 'transparent',
                                border: '1px solid var(--border-strong)',
                                color: 'var(--text-main)',
                                textAlign: 'right',
                                padding: '1px 3px'
                              }}
                            />
                            <span style={{ color: 'var(--text-subtle)' }}>t</span>
                            {p.bursts.length > 1 && (
                              <button
                                onClick={() => handleRemoveBurst(p.pid, bIdx)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '1px' }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Add CPU / IO burst buttons */}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        <button
                          onClick={() => handleAddBurst(p.pid, 'CPU')}
                          className="btn-secondary"
                          style={{ flex: 1, padding: '2px 4px', fontSize: '9px', justifyContent: 'center' }}
                        >
                          + CPU Burst
                        </button>
                        <button
                          onClick={() => handleAddBurst(p.pid, 'IO')}
                          className="btn-secondary"
                          style={{ flex: 1, padding: '2px 4px', fontSize: '9px', justifyContent: 'center' }}
                        >
                          + I/O Burst
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Run Simulation Action Button */}
      <button
        onClick={onRunSimulation}
        disabled={isExecuting || workload.length === 0}
        className="btn-primary"
        style={{
          width: '100%',
          justifyContent: 'center',
          padding: '8px 12px',
          fontWeight: 700,
          letterSpacing: '0.04em'
        }}
        aria-label="Dispatch Simulation Run to Engine"
      >
        <Play size={14} />
        <span>{isExecuting ? 'SIMULATING...' : 'RUN SIMULATION'}</span>
      </button>
    </div>
  );
};
