import React, { useState, useEffect, useReducer, useCallback } from 'react';
import {
  Cpu,
  Layers,
  Database,
  Lock,
  HardDrive,
  Download,
  Keyboard,
  ShieldCheck,
  Zap,
  Activity,
  X,
  FileCode,
  FileSpreadsheet
} from 'lucide-react';
import { ProcessSpec, CpuPolicy, SimulationResponse } from '../../bridge/schema';
import { defaultEngineBridge } from '../../bridge/engineBridge';
import { replayReducer, initialReplayState } from '../../state/replayReducer';
import { GanttTimeline } from '../../features/cpu/GanttTimeline';
import { ProcessStateLanes } from '../../features/cpu/ProcessStateLanes';
import { ReplayControls } from '../../features/cpu/ReplayControls';
import { WorkloadBuilder, WORKLOAD_PRESETS } from '../../features/workload/WorkloadBuilder';
import { CompareView } from '../../features/compare/CompareView';
import { MemoryVisualizer } from '../../features/MemoryVisualizer';
import { SyncVisualizer } from '../../features/SyncVisualizer';
import { DiskVisualizer } from '../../features/DiskVisualizer';

export type SubsystemTab = 'cpu' | 'compare' | 'memory' | 'sync' | 'disk';

export const AppShell: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<SubsystemTab>('cpu');

  // Workload and Policy Configuration
  const [workload, setWorkload] = useState<ProcessSpec[]>(WORKLOAD_PRESETS[0].processes);
  const [policy, setPolicy] = useState<CpuPolicy>('ROUND_ROBIN');
  const [quantum, setQuantum] = useState<number>(3);
  const [preemptive, setPreemptive] = useState<boolean>(true);
  const [aging, setAging] = useState<number>(0);
  const [contextSwitchCost, setContextSwitchCost] = useState<number>(0);
  const [seed] = useState<number>(42);

  // Simulation & Replay Engine State
  const [simResponse, setSimResponse] = useState<SimulationResponse | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [replayState, replayDispatch] = useReducer(replayReducer, initialReplayState);

  // Ergonomics & Accessibility
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isKeyboardModalOpen, setIsKeyboardModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Event stream search/filter state in telemetry panel
  const [eventSearch, setEventSearch] = useState<string>('');

  // Reduced motion toggle effect on document body
  useEffect(() => {
    if (reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }
  }, [reducedMotion]);

  // Execute Simulation in C++ Engine via EngineBridge
  const executeSimulation = useCallback(
    async (
      targetWorkload: ProcessSpec[],
      targetPolicy: CpuPolicy,
      targetQuantum: number,
      targetPreemptive: boolean,
      targetAging: number,
      targetContextSwitchCost: number
    ) => {
      if (targetWorkload.length === 0) {
        setSimResponse(null);
        replayDispatch({ type: 'RESET' });
        return;
      }

      setIsExecuting(true);
      replayDispatch({ type: 'LOAD_START' });

      try {
        const request = {
          schemaVersion: 1,
          runId: `cpu-${targetPolicy.toLowerCase()}-seed${seed}-${Date.now()}`,
          seed,
          module: 'cpu' as const,
          policy: {
            name: targetPolicy,
            quantum: targetQuantum
          },
          workload: {
            processes: targetWorkload
          },
          options: {
            quantum: targetQuantum,
            preemptive: targetPreemptive,
            agingInterval: targetAging,
            contextSwitchCost: targetContextSwitchCost
          }
        };

        const response = await defaultEngineBridge.run(request);
        setSimResponse(response);
        replayDispatch({
          type: 'LOAD_SUCCESS',
          payload: { response, processes: targetWorkload }
        });
      } catch (err: any) {
        setSimResponse(null);
        replayDispatch({
          type: 'LOAD_ERROR',
          payload: { error: err.message || 'Simulation execution fault' }
        });
      } finally {
        setIsExecuting(false);
      }
    },
    [seed]
  );

  // Initial simulation load on mount
  useEffect(() => {
    executeSimulation(workload, policy, quantum, preemptive, aging, contextSwitchCost);
  }, []);

  // Playback timer loop via replayReducer TICK_FORWARD
  useEffect(() => {
    if (replayState.status !== 'playing') return;
    const intervalTime = Math.max(40, Math.floor(400 / replayState.playbackSpeed));
    const timer = setInterval(() => {
      replayDispatch({ type: 'TICK_FORWARD' });
    }, intervalTime);
    return () => clearInterval(timer);
  }, [replayState.status, replayState.playbackSpeed]);

  // Global Keyboard Navigation (docs/ux-system.md Section 5.1)
  useEffect(() => {
    const handleKeyNav = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.key === '1') setActiveTab('cpu');
      else if (e.key === 'c' || e.key === 'C') setActiveTab('compare');
      else if (e.key === '2') setActiveTab('memory');
      else if (e.key === '3') setActiveTab('sync');
      else if (e.key === '4') setActiveTab('disk');
      else if (e.key === '?') setIsKeyboardModalOpen((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, []);

  // Filtered Events for telemetry inspection
  const filteredEvents = simResponse
    ? simResponse.events.filter((ev) => {
        if (!eventSearch) return true;
        const q = eventSearch.toLowerCase();
        return (
          ev.type.toLowerCase().includes(q) ||
          (ev.pid !== null && `p${ev.pid}`.includes(q)) ||
          JSON.stringify(ev.details).toLowerCase().includes(q)
        );
      })
    : [];

  // Export JSON (schemaVersion: 1)
  const handleExportJson = () => {
    if (!simResponse) return;
    const blob = new Blob([JSON.stringify(simResponse, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kernellens-${simResponse.runId || 'simulation'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
  };

  // Export Process Metrics & Events CSV
  const handleExportCsv = () => {
    if (!simResponse) return;
    let csv = '=== KERNEL LENS SIMULATION METRICS ===\n';
    csv += 'PID,Arrival,Waiting Time,Turnaround Time,Response Time,CPU Service\n';
    simResponse.metrics.perProcess.forEach((p) => {
      const proc = workload.find((w) => w.pid === p.pid);
      csv += `${p.pid},${proc?.arrivalTime ?? 0},${p.waitingTime},${p.turnaroundTime},${p.responseTime},${p.cpuService}\n`;
    });

    csv += '\n=== SUMMARY AVERAGES ===\n';
    csv += `Average Waiting Time,${simResponse.metrics.averages.waitingTime}\n`;
    csv += `Average Turnaround Time,${simResponse.metrics.averages.turnaroundTime}\n`;
    csv += `Average Response Time,${simResponse.metrics.averages.responseTime}\n`;
    csv += `CPU Utilization,${(simResponse.metrics.cpuUtilization * 100).toFixed(2)}%\n`;
    csv += `Context Switches,${simResponse.metrics.contextSwitches}\n`;
    csv += `Throughput,${simResponse.metrics.throughput}\n`;
    csv += `Jain Fairness Index,${simResponse.metrics.jainFairness ?? 'N/A'}\n`;

    csv += '\n=== EVENT LOG (schemaVersion: 1) ===\n';
    csv += 'Seq,Time,Subsystem,Type,PID,Details\n';
    simResponse.events.forEach((e) => {
      csv += `${e.seq},${e.time},${e.subsystem},${e.type},${e.pid ?? 'N/A'},"${JSON.stringify(e.details).replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kernellens-${simResponse.runId || 'simulation'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--surface-canvas, #0b0d10)',
        color: 'var(--text-main, #f8fafc)',
        overflowX: 'hidden'
      }}
    >
      {/* 1. MISSION CONTROL TOP HEADER */}
      <header
        style={{
          background: 'var(--surface-panel, #12151a)',
          borderBottom: '1px solid var(--border-subtle, #1f242d)',
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          zIndex: 50
        }}
      >
        {/* Title and Lab Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: 24,
                height: 24,
                background: '#0284c7',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              K
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.04em' }}>
                  KERNELLENS
                </span>
                <span className="badge badge-cyan" style={{ fontSize: '9px' }}>
                  MISSION CONTROL
                </span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                Deterministic C++17 Discrete-Event Simulation Laboratory
              </div>
            </div>
          </div>

          {/* Subsystem Navigation Tabs */}
          <nav
            style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}
            aria-label="Subsystem Navigation"
          >
            <button
              onClick={() => setActiveTab('cpu')}
              className={`btn-secondary ${activeTab === 'cpu' ? 'btn-active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '11px' }}
              aria-label="CPU Scheduling Subsystem (1)"
            >
              <Cpu size={12} />
              <span>CPU (1)</span>
            </button>

            <button
              onClick={() => setActiveTab('compare')}
              className={`btn-secondary ${activeTab === 'compare' ? 'btn-active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '11px' }}
              aria-label="Multi-Policy Comparison Mode (C)"
            >
              <Layers size={12} />
              <span>Compare (C)</span>
            </button>

            <button
              onClick={() => setActiveTab('memory')}
              className={`btn-secondary ${activeTab === 'memory' ? 'btn-active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '11px' }}
              aria-label="Virtual Memory Subsystem (2)"
            >
              <Database size={12} />
              <span>Memory (2)</span>
            </button>

            <button
              onClick={() => setActiveTab('sync')}
              className={`btn-secondary ${activeTab === 'sync' ? 'btn-active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '11px' }}
              aria-label="Concurrency and Sync Subsystem (3)"
            >
              <Lock size={12} />
              <span>Sync (3)</span>
            </button>

            <button
              onClick={() => setActiveTab('disk')}
              className={`btn-secondary ${activeTab === 'disk' ? 'btn-active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '11px' }}
              aria-label="Disk Scheduling Subsystem (4)"
            >
              <HardDrive size={12} />
              <span>Disk (4)</span>
            </button>
          </nav>
        </div>

        {/* Action Bar: Telemetry, Reduced Motion, Export, Keyboard Help */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="badge"
            title="Deterministic PRNG Seed"
            style={{ background: 'var(--surface-subpanel)', color: 'var(--text-subtle)' }}
          >
            SEED: {seed}
          </span>

          <span
            className="badge"
            title="Single Event Stream Contract: schemaVersion 1"
            style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}
          >
            <ShieldCheck size={11} />
            schemaVersion: 1
          </span>

          {/* Reduced Motion Toggle */}
          <button
            onClick={() => setReducedMotion((prev) => !prev)}
            className={`btn-secondary ${reducedMotion ? 'btn-active' : ''}`}
            title="Toggle Reduced Motion mode"
            style={{ padding: '3px 8px', fontSize: '10px' }}
            aria-label="Toggle Reduced Motion"
          >
            <span>Motion: {reducedMotion ? 'OFF' : 'ON'}</span>
          </button>

          {/* Export Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="btn-secondary"
            style={{ padding: '3px 8px', fontSize: '11px' }}
            title="Export Simulation JSON / CSV"
            aria-label="Export Simulation Data"
          >
            <Download size={12} />
            <span>Export</span>
          </button>

          {/* Keyboard Shortcuts Trigger */}
          <button
            onClick={() => setIsKeyboardModalOpen(true)}
            className="btn-secondary"
            style={{ padding: '3px 7px', fontSize: '11px' }}
            title="Keyboard Shortcuts (?)"
            aria-label="Open Keyboard Shortcuts Modal"
          >
            <Keyboard size={12} />
          </button>
        </div>
      </header>

      {/* 2. MAIN SUB-SYSTEM CONTENT AREA */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'cpu' && (
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'minmax(280px, 310px) minmax(400px, 1fr) minmax(280px, 320px)',
              gap: '12px',
              padding: '12px 16px 80px 16px',
              alignItems: 'start'
            }}
            className="mission-control-grid"
          >
            {/* Left Column: Workload Builder & Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
              <WorkloadBuilder
                workload={workload}
                onChangeWorkload={(newW) => {
                  setWorkload(newW);
                  executeSimulation(newW, policy, quantum, preemptive, aging, contextSwitchCost);
                }}
                onRunSimulation={() =>
                  executeSimulation(workload, policy, quantum, preemptive, aging, contextSwitchCost)
                }
                selectedPolicy={policy}
                onChangePolicy={(newP) => {
                  setPolicy(newP);
                  executeSimulation(workload, newP, quantum, preemptive, aging, contextSwitchCost);
                }}
                quantum={quantum}
                onChangeQuantum={(q) => {
                  setQuantum(q);
                  executeSimulation(workload, policy, q, preemptive, aging, contextSwitchCost);
                }}
                preemptive={preemptive}
                onChangePreemptive={(pr) => {
                  setPreemptive(pr);
                  executeSimulation(workload, policy, quantum, pr, aging, contextSwitchCost);
                }}
                aging={aging}
                onChangeAging={(ag) => {
                  setAging(ag);
                  executeSimulation(workload, policy, quantum, preemptive, ag, contextSwitchCost);
                }}
                contextSwitchCost={contextSwitchCost}
                onChangeContextSwitchCost={(cs) => {
                  setContextSwitchCost(cs);
                  executeSimulation(workload, policy, quantum, preemptive, aging, cs);
                }}
                isExecuting={isExecuting}
              />
            </div>

            {/* Center Column: D3 Gantt Timeline + Process State Lanes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
              {/* Primary D3 Multi-Lane Gantt Timeline */}
              <GanttTimeline
                events={replayState.events}
                processes={workload}
                currentTick={replayState.currentTick}
                maxTick={replayState.maxTick}
                quantum={quantum}
                reducedMotion={reducedMotion}
                onScrub={(t) => replayDispatch({ type: 'SCRUB_TO_TICK', payload: { tick: t } })}
              />

              {/* Real-time Process State Lanes (RUNNING, READY, WAITING, TERMINATED) */}
              <ProcessStateLanes
                engineState={replayState.currentState}
                processes={workload}
                currentTick={replayState.currentTick}
                simResponse={simResponse}
              />
            </div>

            {/* Right Column: Live Telemetry & Event Stream Inspection */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                height: '100%'
              }}
            >
              {/* Metrics Card */}
              <div
                className="glass-panel"
                style={{
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} color="var(--primary-cyan)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      ENGINE METRICS
                    </span>
                  </div>
                  <span className="badge badge-emerald">CANONICAL</span>
                </div>

                {simResponse ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    <div style={{ background: 'var(--surface-subpanel)', padding: '6px 8px', borderRadius: '2px' }}>
                      <span style={{ color: 'var(--text-subtle)', fontSize: '9px', display: 'block' }}>AVG WAITING</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {simResponse.metrics.averages.waitingTime.toFixed(2)}t
                      </span>
                    </div>

                    <div style={{ background: 'var(--surface-subpanel)', padding: '6px 8px', borderRadius: '2px' }}>
                      <span style={{ color: 'var(--text-subtle)', fontSize: '9px', display: 'block' }}>AVG TURNAROUND</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {simResponse.metrics.averages.turnaroundTime.toFixed(2)}t
                      </span>
                    </div>

                    <div style={{ background: 'var(--surface-subpanel)', padding: '6px 8px', borderRadius: '2px' }}>
                      <span style={{ color: 'var(--text-subtle)', fontSize: '9px', display: 'block' }}>CPU UTILIZATION</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#00a389' }}>
                        {(simResponse.metrics.cpuUtilization * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div style={{ background: 'var(--surface-subpanel)', padding: '6px 8px', borderRadius: '2px' }}>
                      <span style={{ color: 'var(--text-subtle)', fontSize: '9px', display: 'block' }}>CONTEXT SWITCHES</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>
                        {simResponse.metrics.contextSwitches}
                      </span>
                    </div>

                    <div style={{ background: 'var(--surface-subpanel)', padding: '6px 8px', borderRadius: '2px' }}>
                      <span style={{ color: 'var(--text-subtle)', fontSize: '9px', display: 'block' }}>THROUGHPUT</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {simResponse.metrics.throughput.toFixed(3)}/t
                      </span>
                    </div>

                    <div style={{ background: 'var(--surface-subpanel)', padding: '6px 8px', borderRadius: '2px' }}>
                      <span style={{ color: 'var(--text-subtle)', fontSize: '9px', display: 'block' }}>JAIN FAIRNESS</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#c084fc' }}>
                        {simResponse.metrics.jainFairness !== null ? simResponse.metrics.jainFairness.toFixed(3) : 'N/A'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-subtle)', fontSize: '11px', textAlign: 'center', padding: '10px' }}>
                    No simulation loaded.
                  </div>
                )}
              </div>

              {/* Event Stream Inspector */}
              <div
                className="glass-panel"
                style={{
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  flex: 1,
                  maxHeight: '440px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={14} color="var(--primary-cyan)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      EVENT STREAM LOG
                    </span>
                  </div>
                  <span className="badge badge-gray">{filteredEvents.length} EVENTS</span>
                </div>

                <input
                  type="text"
                  placeholder="Filter events by type or PID..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  style={{
                    background: 'var(--surface-subpanel)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-main)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    padding: '4px 8px'
                  }}
                  aria-label="Filter Event Log"
                />

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    overflowY: 'auto',
                    flex: 1,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px'
                  }}
                >
                  {filteredEvents.map((e) => {
                    const isPassed = e.time <= replayState.currentTick;
                    return (
                      <div
                        key={e.seq}
                        style={{
                          padding: '4px 6px',
                          background: isPassed ? 'rgba(0, 163, 137, 0.08)' : 'var(--surface-subpanel)',
                          borderLeft: `2px solid ${isPassed ? '#00a389' : 'var(--border-subtle)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          opacity: isPassed ? 1 : 0.6
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--primary-cyan)', fontWeight: 600 }}>T={e.time}</span>
                          <span style={{ color: 'var(--text-subtle)' }}>#{e.seq}</span>
                          <span style={{ color: isPassed ? '#10b981' : 'var(--text-subtle)', fontWeight: 700 }}>
                            {e.type}
                          </span>
                          {e.pid !== null && (
                            <span style={{ color: '#38bdf8', fontWeight: 600 }}>P{e.pid}</span>
                          )}
                        </div>
                        <div style={{ color: 'var(--text-subtle)', fontSize: '9px', wordBreak: 'break-all' }}>
                          {JSON.stringify(e.details)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Policy Comparison */}
        {activeTab === 'compare' && (
          <div style={{ paddingBottom: '70px' }}>
            <CompareView workload={workload} quantum={quantum} seed={seed} reducedMotion={reducedMotion} />
          </div>
        )}

        {/* Tab: Virtual Memory */}
        {activeTab === 'memory' && (
          <div style={{ padding: '16px', paddingBottom: '70px' }}>
            <MemoryVisualizer />
          </div>
        )}

        {/* Tab: Synchronization & Deadlocks */}
        {activeTab === 'sync' && (
          <div style={{ padding: '16px', paddingBottom: '70px' }}>
            <SyncVisualizer />
          </div>
        )}

        {/* Tab: Disk Scheduling */}
        {activeTab === 'disk' && (
          <div style={{ padding: '16px', paddingBottom: '70px' }}>
            <DiskVisualizer />
          </div>
        )}
      </main>

      {/* 3. MASTER SIMULATION DECK (Docked at bottom of viewport for CPU tab) */}
      {activeTab === 'cpu' && (
        <footer
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'var(--surface-panel, #12151a)',
            borderTop: '1px solid var(--border-contrast, #434f63)',
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.7)'
          }}
        >
          <div style={{ maxWidth: '1800px', margin: '0 auto', padding: '0 12px' }}>
            <ReplayControls
              state={replayState}
              dispatch={replayDispatch}
              runId={simResponse?.runId}
              policyName={policy}
              onOpenKeyboardHelp={() => setIsKeyboardModalOpen(true)}
            />
          </div>
        </footer>
      )}

      {/* 4. KEYBOARD SHORTCUTS MODAL */}
      {isKeyboardModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={() => setIsKeyboardModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '440px',
              width: '100%',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              border: '1px solid var(--border-contrast)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Keyboard size={16} color="var(--primary-cyan)" />
                <h3 style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  MISSION CONTROL KEYBOARD SHORTCUTS
                </h3>
              </div>
              <button
                onClick={() => setIsKeyboardModalOpen(false)}
                className="btn-secondary"
                style={{ padding: '2px 5px' }}
                aria-label="Close Modal"
              >
                <X size={13} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--primary-cyan)', fontWeight: 700 }}>Space</span>
                <span>Toggle Play / Pause simulation</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--primary-cyan)', fontWeight: 700 }}>ArrowRight</span>
                <span>Step forward 1 simulation tick</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--primary-cyan)', fontWeight: 700 }}>ArrowLeft</span>
                <span>Step backward (checkpoint replay)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--primary-cyan)', fontWeight: 700 }}>Home / End</span>
                <span>Jump to tick 0 / Jump to termination</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--primary-cyan)', fontWeight: 700 }}>1 – 4</span>
                <span>Switch: 1=CPU, 2=Memory, 3=Sync, 4=Disk</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--primary-cyan)', fontWeight: 700 }}>C</span>
                <span>Toggle Multi-Policy Compare Mode</span>
              </div>
            </div>

            <button
              onClick={() => setIsKeyboardModalOpen(false)}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 5. EXPORT MODAL (JSON / CSV) */}
      {isExportModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={() => setIsExportModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '400px',
              width: '100%',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              border: '1px solid var(--border-contrast)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={16} color="var(--primary-cyan)" />
                <h3 style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  EXPORT SIMULATION DATA
                </h3>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="btn-secondary"
                style={{ padding: '2px 5px' }}
                aria-label="Close Export Modal"
              >
                <X size={13} />
              </button>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
              Download canonical simulation execution data produced by the deterministic C++17 engine.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleExportJson}
                className="btn-secondary"
                style={{ justifyContent: 'space-between', padding: '10px 14px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCode size={16} color="var(--primary-cyan)" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: '12px' }}>Normalized Event Log (JSON)</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-subtle)' }}>
                      Conforming to schemaVersion: 1 specification
                    </div>
                  </div>
                </div>
                <span className="badge badge-cyan">.JSON</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="btn-secondary"
                style={{ justifyContent: 'space-between', padding: '10px 14px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={16} color="#10b981" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: '12px' }}>Spreadsheet Metrics (CSV)</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-subtle)' }}>
                      Per-process metrics, summary averages, and event records
                    </div>
                  </div>
                </div>
                <span className="badge badge-emerald">.CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
