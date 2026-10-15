import React, { useState, useEffect, useRef, useMemo, useReducer } from 'react';
import * as d3 from 'd3';
import {
  Zap,
  Cpu,
  ListFilter,
  AlertTriangle,
  Search,
  Activity
} from 'lucide-react';
import { defaultEngineBridge, SUPPORTED_CPU_POLICIES } from '../bridge/engineBridge';
import {
  CpuPolicy,
  ProcessSpec,
  SimulationResponse,
  SimulationRequest
} from '../bridge/schema';
import { ReplayControls } from '../components/ReplayControls';
import { replayReducer, initialReplayState } from '../state/replayReducer';

// Presets for deterministic OS lab scenarios
const PRESET_CONVOY: ProcessSpec[] = [
  { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 24 }], basePriority: 0, niceValue: 0 },
  { pid: 2, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 },
  { pid: 3, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 }
];

const PRESET_SJF: ProcessSpec[] = [
  { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 6 }], basePriority: 0, niceValue: 0 },
  { pid: 2, arrivalTime: 1, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 0, niceValue: 0 },
  { pid: 3, arrivalTime: 2, bursts: [{ kind: 'CPU', duration: 8 }], basePriority: 0, niceValue: 0 },
  { pid: 4, arrivalTime: 3, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 }
];

const PRESET_STARVATION: ProcessSpec[] = [
  { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 20 }], basePriority: 10, niceValue: 0 },
  { pid: 2, arrivalTime: 1, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: 0 },
  { pid: 3, arrivalTime: 5, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: 0 },
  { pid: 4, arrivalTime: 9, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: 0 },
  { pid: 5, arrivalTime: 13, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: 0 }
];

const PRESET_INTERACTIVE: ProcessSpec[] = [
  { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 4 }, { kind: 'IO', duration: 3 }, { kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: 0 },
  { pid: 2, arrivalTime: 2, bursts: [{ kind: 'CPU', duration: 3 }, { kind: 'IO', duration: 5 }, { kind: 'CPU', duration: 2 }], basePriority: 2, niceValue: 0 },
  { pid: 3, arrivalTime: 4, bursts: [{ kind: 'CPU', duration: 6 }, { kind: 'IO', duration: 2 }, { kind: 'CPU', duration: 1 }], basePriority: 3, niceValue: 0 }
];

export const CpuReplay: React.FC = () => {
  // Configuration state
  const [policy, setPolicy] = useState<CpuPolicy>('ROUND_ROBIN');
  const [quantum, setQuantum] = useState<number>(3);
  const [preemptive, setPreemptive] = useState<boolean>(true);
  const [aging, setAging] = useState<number>(0);
  const [contextSwitchCost, setContextSwitchCost] = useState<number>(0);
  const [workload, setWorkload] = useState<ProcessSpec[]>(PRESET_CONVOY);
  const [presetName, setPresetName] = useState<string>('Convoy Effect');

  // Simulation execution state
  const [simResponse, setSimResponse] = useState<SimulationResponse | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Replay State Machine (deterministic checkpoint scrubbing)
  const [replayState, replayDispatch] = useReducer(replayReducer, initialReplayState);
  const currentTick = replayState.currentTick;

  // Event Table Filter state
  const [eventFilter, setEventFilter] = useState<string>('ALL');
  const [eventSearch, setEventSearch] = useState<string>('');

  const svgRef = useRef<SVGSVGElement | null>(null);
  const eventTableContainerRef = useRef<HTMLDivElement | null>(null);

  // Mock-free bridge execution triggering EngineBridge.run(request)
  const executeSimulation = async (
    targetWorkload: ProcessSpec[],
    targetPolicy: CpuPolicy,
    targetQuantum: number,
    targetPreemptive: boolean,
    targetAging: number,
    targetContextSwitchCost: number
  ) => {
    if (targetWorkload.length === 0) {
      setSimResponse(null);
      setErrorMessage(null);
      replayDispatch({ type: 'RESET' });
      return;
    }

    setIsExecuting(true);
    setErrorMessage(null);
    replayDispatch({ type: 'LOAD_START' });

    try {
      const request: SimulationRequest = {
        schemaVersion: 1,
        runId: `cpu-${targetPolicy.toLowerCase()}-${Date.now()}`,
        seed: 42,
        module: 'cpu',
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
      setErrorMessage(err.message || 'Simulation execution failed');
      setSimResponse(null);
      replayDispatch({
        type: 'LOAD_ERROR',
        payload: { error: err.message || 'Simulation execution failed' }
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Initial load
  useEffect(() => {
    executeSimulation(workload, policy, quantum, preemptive, aging, contextSwitchCost);
  }, []);

  const maxDuration = simResponse?.simulatedDuration ?? 0;

  // Playback loop via replayReducer TICK_FORWARD
  useEffect(() => {
    if (replayState.status !== 'playing') return;
    const intervalTime = Math.max(50, Math.floor(500 / replayState.playbackSpeed));
    const timer = setInterval(() => {
      replayDispatch({ type: 'TICK_FORWARD' });
    }, intervalTime);
    return () => clearInterval(timer);
  }, [replayState.status, replayState.playbackSpeed]);

  // D3 Gantt chart rendering
  useEffect(() => {
    if (!svgRef.current || !simResponse || workload.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 900;
    const height = Math.max(260, workload.length * 48 + 80);
    const margin = { top: 30, right: 30, bottom: 40, left: 70 };

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const pids = workload.map(p => p.pid);
    const yScale = d3.scaleBand()
      .domain(pids.map(String))
      .range([margin.top, height - margin.bottom])
      .padding(0.3);

    const xScale = d3.scaleLinear()
      .domain([0, maxDuration])
      .range([margin.left, width - margin.right]);

    // X-Axis
    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.min(maxDuration, 20))
      .tickFormat(d => `${d}t`);

    svg.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(xAxis)
      .attr('color', 'var(--text-subtle)')
      .selectAll('text')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '11px');

    // Y-Axis
    const yAxis = d3.axisLeft(yScale)
      .tickFormat(d => `P${d}`);

    svg.append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(yAxis)
      .attr('color', 'var(--text-subtle)')
      .selectAll('text')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', 'var(--text-main)');

    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(10).tickSize(-height + margin.top + margin.bottom).tickFormat(() => ''))
      .attr('stroke', 'rgba(255, 255, 255, 0.04)');

    // Process burst intervals extracted from canonical event stream
    const intervals: { pid: number; start: number; end: number; type: string }[] = [];
    simResponse.events.forEach((evt, idx) => {
      if (evt.type === 'dispatch' && evt.pid !== null) {
        let end = maxDuration;
        for (let j = idx + 1; j < simResponse.events.length; ++j) {
          const next = simResponse.events[j];
          if (next.pid === evt.pid && (next.type === 'quantum_expired' || next.type === 'cpu_burst_completed' || next.type === 'preempt')) {
            end = next.time;
            break;
          }
        }
        intervals.push({
          pid: evt.pid,
          start: evt.time,
          end,
          type: 'RUNNING'
        });
      }
    });

    const colors = ['#00f2fe', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

    // Render bars
    intervals.forEach(d => {
      const isVisible = d.start <= currentTick;
      const barEnd = Math.min(d.end, currentTick);
      if (!isVisible || barEnd <= d.start) return;

      const barColor = colors[(d.pid - 1) % colors.length];

      svg.append('rect')
        .attr('x', xScale(d.start))
        .attr('y', yScale(String(d.pid))!)
        .attr('width', Math.max(2, xScale(barEnd) - xScale(d.start)))
        .attr('height', yScale.bandwidth())
        .attr('rx', 6)
        .attr('fill', barColor)
        .attr('opacity', 0.9)
        .attr('stroke', 'rgba(255,255,255,0.3)')
        .attr('stroke-width', 1)
        .style('filter', 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))');

      // Label inside bar
      if (xScale(barEnd) - xScale(d.start) > 28) {
        svg.append('text')
          .attr('x', xScale(d.start) + 8)
          .attr('y', yScale(String(d.pid))! + yScale.bandwidth() / 2 + 4)
          .text(`[${d.start}-${d.end}]`)
          .attr('fill', '#070a12')
          .attr('font-size', '10px')
          .attr('font-family', 'var(--font-mono)')
          .attr('font-weight', '700');
      }
    });

    // Time Scrubber Needle
    const needleX = xScale(currentTick);
    svg.append('line')
      .attr('x1', needleX)
      .attr('x2', needleX)
      .attr('y1', margin.top - 10)
      .attr('y2', height - margin.bottom)
      .attr('stroke', '#ff4b2b')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '3 3');

    svg.append('circle')
      .attr('cx', needleX)
      .attr('cy', margin.top - 10)
      .attr('r', 5)
      .attr('fill', '#ff4b2b');

  }, [simResponse, currentTick, maxDuration, workload]);

  // Filtered events for the event table
  const filteredEvents = useMemo(() => {
    if (!simResponse) return [];
    return simResponse.events.filter(evt => {
      const matchesType = eventFilter === 'ALL' || evt.type.toLowerCase() === eventFilter.toLowerCase();
      const searchLower = eventSearch.trim().toLowerCase();
      const matchesSearch =
        !searchLower ||
        evt.type.toLowerCase().includes(searchLower) ||
        (evt.pid !== null && `p${evt.pid}`.includes(searchLower)) ||
        JSON.stringify(evt.details).toLowerCase().includes(searchLower);
      return matchesType && matchesSearch;
    });
  }, [simResponse, eventFilter, eventSearch]);

  const uniqueEventTypes = useMemo(() => {
    if (!simResponse) return [];
    const set = new Set<string>();
    simResponse.events.forEach(e => set.add(e.type));
    return Array.from(set);
  }, [simResponse]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 24px', maxWidth: 1600, margin: '0 auto', width: '100%' }}>
      {/* Route Sub-header with Engine Contract Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cpu size={24} color="var(--primary-cyan)" />
            <span>CPU Scheduling Simulator & Event Replay</span>
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-subtle)', marginTop: 4 }}>
            Deterministic discrete-event replay driven by C++17 engine bridge contract (<code style={{ color: 'var(--primary-cyan)' }}>schemaVersion: 1</code>).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: simResponse ? 'var(--accent-emerald)' : 'var(--text-subtle)' }} />
            <span>{isExecuting ? 'Simulating...' : simResponse ? 'Engine Ready' : 'Standby'}</span>
          </div>
          <span className="badge badge-cyan">Seed: 42</span>
          <span className="badge badge-emerald">Ticks: int64_t</span>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#fca5a5',
          fontSize: '0.85rem'
        }}>
          <AlertTriangle size={18} />
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Mock-Free Run Controls Panel */}
      <div className="glass-panel" style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Row 1: Workload Presets */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, minWidth: 70 }}>Workload:</span>
          {[
            { name: 'Convoy Effect', data: PRESET_CONVOY },
            { name: 'SJF Benchmark', data: PRESET_SJF },
            { name: 'Starvation', data: PRESET_STARVATION },
            { name: 'Interactive Mixed', data: PRESET_INTERACTIVE },
            { name: 'Unloaded (Empty)', data: [] }
          ].map(p => (
            <button
              key={p.name}
              onClick={() => {
                setPresetName(p.name);
                setWorkload(p.data);
                executeSimulation(p.data, policy, quantum, preemptive, aging, contextSwitchCost);
              }}
              className={`btn-secondary ${presetName === p.name ? 'btn-active' : ''}`}
              style={{ fontSize: '0.78rem', padding: '5px 12px' }}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Row 2: Policy Selection and Parameters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, minWidth: 70 }}>Policy:</span>
            {SUPPORTED_CPU_POLICIES.map(pol => (
              <button
                key={pol}
                onClick={() => {
                  setPolicy(pol);
                  executeSimulation(workload, pol, quantum, preemptive, aging, contextSwitchCost);
                }}
                className={`btn-secondary ${policy === pol ? 'btn-active' : ''}`}
                style={{ fontSize: '0.78rem', padding: '5px 10px' }}
              >
                {pol}
              </button>
            ))}
          </div>

          {/* Policy-specific Options & Run Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {(policy === 'ROUND_ROBIN' || policy === 'MLFQ') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--primary-cyan)', fontWeight: 600 }}>Quantum:</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={quantum}
                  onChange={e => {
                    const q = Math.max(1, parseInt(e.target.value) || 1);
                    setQuantum(q);
                    executeSimulation(workload, policy, q, preemptive, aging, contextSwitchCost);
                  }}
                  style={{ width: 50, padding: '4px 6px', fontSize: '0.78rem', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: '#fff' }}
                />
              </div>
            )}

            {policy === 'PRIORITY' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preemptive}
                    onChange={e => {
                      setPreemptive(e.target.checked);
                      executeSimulation(workload, policy, quantum, e.target.checked, aging, contextSwitchCost);
                    }}
                  />
                  Preemptive
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--primary-cyan)', fontWeight: 600 }}>Aging Interval:</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={aging}
                    onChange={e => {
                      const a = Math.max(0, parseInt(e.target.value) || 0);
                      setAging(a);
                      executeSimulation(workload, policy, quantum, preemptive, a, contextSwitchCost);
                    }}
                    style={{ width: 50, padding: '4px 6px', fontSize: '0.78rem', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: '#fff' }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>CS Cost:</span>
              <input
                type="number"
                min={0}
                max={10}
                value={contextSwitchCost}
                onChange={e => {
                  const c = Math.max(0, parseInt(e.target.value) || 0);
                  setContextSwitchCost(c);
                  executeSimulation(workload, policy, quantum, preemptive, aging, c);
                }}
                style={{ width: 44, padding: '4px 6px', fontSize: '0.78rem', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: '#fff' }}
              />
            </div>

            {/* Explicit Mock-Free Run Button */}
            <button
              onClick={() => executeSimulation(workload, policy, quantum, preemptive, aging, contextSwitchCost)}
              disabled={isExecuting || workload.length === 0}
              className="btn-primary"
              style={{ fontSize: '0.78rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Activity size={14} />
              <span>{isExecuting ? 'Running...' : 'Run Simulation'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Visualizer Workspace Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Left Column: Interactive D3 Gantt Replay */}
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>Interactive CPU Gantt Replay</span>
                <span className="badge badge-cyan">{policy}</span>
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: 4 }}>
                Discrete ticks ordered monotonically. Drag scrubber or use playback controls to step through execution.
              </p>
            </div>
            {simResponse && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono-val" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-cyan)' }}>
                  {currentTick} / {maxDuration}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>ticks</span>
              </div>
            )}
          </div>

          {/* D3 Canvas Container */}
          <div style={{ width: '100%', overflowX: 'auto', background: 'rgba(5, 8, 14, 0.6)', borderRadius: 'var(--radius-md)', padding: 10, minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!simResponse || workload.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                No simulation is loaded.
              </div>
            ) : (
              <svg ref={svgRef} style={{ width: '100%', height: 'auto', display: 'block' }}></svg>
            )}
          </div>

          {/* Time Scrubber & Replay Controls (WASM / Worker Bridge Replay Machine) */}
          {simResponse && workload.length > 0 && (
            <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <ReplayControls state={replayState} dispatch={replayDispatch} />
            </div>
          )}
        </div>

        {/* Right Column: Quantitative Metrics (Canonical Engine Metrics Only) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Metrics Summary Card */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} color="var(--primary-cyan)" />
              Simulation Metrics
            </h3>

            {!simResponse || workload.length === 0 ? (
              <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No simulation is loaded.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Avg Waiting</span>
                  <p className="mono-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                    {simResponse.metrics.averages.waitingTime.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>t</span>
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Avg Turnaround</span>
                  <p className="mono-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                    {simResponse.metrics.averages.turnaroundTime.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>t</span>
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Avg Response</span>
                  <p className="mono-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                    {simResponse.metrics.averages.responseTime.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>t</span>
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>CPU Utilization</span>
                  <p className="mono-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: 4 }}>
                    {(simResponse.metrics.cpuUtilization * 100).toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>%</span>
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Context Switches</span>
                  <p className="mono-val" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                    {simResponse.metrics.contextSwitches}
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Throughput</span>
                  <p className="mono-val" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                    {simResponse.metrics.throughput.toFixed(3)} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>p/t</span>
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)', gridColumn: 'span 2' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Jain Fairness Index</span>
                  <p className="mono-val" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-cyan)', marginTop: 4 }}>
                    {simResponse.metrics.jainFairness !== null ? simResponse.metrics.jainFairness.toFixed(3) : '1.000'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Process Breakdown Table */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-muted)' }}>
              Per-Process Metrics
            </h3>
            {!simResponse || workload.length === 0 ? (
              <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No simulation is loaded.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-subtle)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px' }}>PID</th>
                    <th style={{ padding: '6px 4px' }}>Wait</th>
                    <th style={{ padding: '6px 4px' }}>Turn</th>
                    <th style={{ padding: '6px 4px' }}>Resp</th>
                    <th style={{ padding: '6px 4px' }}>CPU</th>
                  </tr>
                </thead>
                <tbody>
                  {simResponse.metrics.perProcess.map(pm => (
                    <tr key={pm.pid} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px 4px', fontWeight: 700, color: 'var(--primary-cyan)' }}>P{pm.pid}</td>
                      <td className="mono-val" style={{ padding: '8px 4px' }}>{pm.waitingTime}</td>
                      <td className="mono-val" style={{ padding: '8px 4px' }}>{pm.turnaroundTime}</td>
                      <td className="mono-val" style={{ padding: '8px 4px' }}>{pm.responseTime}</td>
                      <td className="mono-val" style={{ padding: '8px 4px' }}>{pm.cpuService}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Temporary Readable Event Table (Raw Simulation Event Stream) */}
      <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ListFilter size={18} color="var(--primary-cyan)" />
              <span>Simulation Event Log</span>
              <span className="badge badge-cyan">{filteredEvents.length} events</span>
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: 4 }}>
              Total ordering: <code style={{ color: 'var(--text-muted)' }}>(time, priority, seq)</code>. Playhead currently at <span style={{ color: 'var(--primary-cyan)', fontWeight: 600 }}>tick {currentTick}</span>.
            </p>
          </div>

          {/* Event Filter & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Filter by Type */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>Type:</span>
              <select
                value={eventFilter}
                onChange={e => setEventFilter(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  fontSize: '0.78rem',
                  padding: '4px 8px'
                }}
              >
                <option value="ALL">All Types</option>
                {uniqueEventTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: 8, color: 'var(--text-subtle)' }} />
              <input
                type="text"
                placeholder="Search PID / details..."
                value={eventSearch}
                onChange={e => setEventSearch(e.target.value)}
                style={{
                  padding: '4px 8px 4px 28px',
                  fontSize: '0.78rem',
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  width: 170
                }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Event Table Container */}
        <div
          ref={eventTableContainerRef}
          style={{
            maxHeight: 380,
            overflowY: 'auto',
            background: 'rgba(5, 8, 14, 0.5)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          {!simResponse || workload.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              No simulation is loaded.
            </div>
          ) : filteredEvents.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No events match the selected filter.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0d111a', borderBottom: '1px solid var(--border-subtle)', zIndex: 2 }}>
                <tr style={{ color: 'var(--text-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', width: 60 }}>Seq</th>
                  <th style={{ padding: '8px 12px', width: 80 }}>Tick</th>
                  <th style={{ padding: '8px 12px', width: 90 }}>Subsystem</th>
                  <th style={{ padding: '8px 12px', width: 160 }}>Type</th>
                  <th style={{ padding: '8px 12px', width: 70 }}>PID</th>
                  <th style={{ padding: '8px 12px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map(evt => {
                  const isCurrent = evt.time === currentTick;
                  const isPast = evt.time <= currentTick;
                  const typeBadgeColor =
                    evt.type === 'dispatch'
                      ? 'var(--accent-emerald)'
                      : evt.type === 'quantum_expired'
                      ? 'var(--accent-amber)'
                      : evt.type === 'preempt'
                      ? '#ec4899'
                      : evt.type === 'process_terminated' || evt.type === 'cpu_burst_completed'
                      ? 'var(--accent-indigo)'
                      : 'var(--primary-cyan)';

                  return (
                    <tr
                      key={evt.seq}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                        background: isCurrent
                          ? 'rgba(0, 242, 254, 0.08)'
                          : 'transparent',
                        opacity: isPast ? 1 : 0.45,
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td className="mono-val" style={{ padding: '8px 12px', color: 'var(--text-subtle)' }}>
                        #{evt.seq}
                      </td>
                      <td className="mono-val" style={{ padding: '8px 12px', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--primary-cyan)' : 'inherit' }}>
                        {evt.time}t
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                          {evt.subsystem}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'rgba(0,0,0,0.3)',
                          border: `1px solid ${typeBadgeColor}`,
                          color: typeBadgeColor
                        }}>
                          {evt.type}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: evt.pid !== null ? 'var(--text-main)' : 'var(--text-subtle)' }}>
                        {evt.pid !== null ? `P${evt.pid}` : '-'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                        {Object.entries(evt.details).map(([k, v]) => (
                          <span key={k} style={{ marginRight: 10, display: 'inline-block' }}>
                            <span style={{ color: 'var(--text-subtle)' }}>{k}:</span>{' '}
                            <span style={{ color: typeof v === 'number' ? 'var(--primary-cyan)' : 'var(--text-main)' }}>
                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
