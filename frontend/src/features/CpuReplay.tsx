import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Play, Pause, RotateCcw, SkipForward, SkipBack, Zap } from 'lucide-react';
import { runCpuSimulation } from '../bridge/simulationBridge';
import { CpuPolicy, ProcessSpec } from '../types/schema';

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
  const [policy, setPolicy] = useState<CpuPolicy>('ROUND_ROBIN');
  const [quantum, setQuantum] = useState(3);
  const [preemptive, setPreemptive] = useState(true);
  const [aging, setAging] = useState(0);
  const [workload, setWorkload] = useState<ProcessSpec[]>(PRESET_CONVOY);
  const [presetName, setPresetName] = useState('Convoy Effect');

  const [currentTick, setCurrentTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Run simulation
  const simResult = React.useMemo(() => {
    return runCpuSimulation(workload, policy, {
      quantum,
      preemptive,
      agingInterval: aging
    });
  }, [workload, policy, quantum, preemptive, aging]);

  const maxDuration = simResult.simulatedDuration || 1;

  // Timer loop for Play/Pause
  useEffect(() => {
    if (!isPlaying) return;
    const intervalTime = Math.max(50, Math.floor(500 / playbackSpeed));
    const timer = setInterval(() => {
      setCurrentTick(t => {
        if (t >= maxDuration) {
          setIsPlaying(false);
          return maxDuration;
        }
        return t + 1;
      });
    }, intervalTime);
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, maxDuration]);

  // D3 Gantt chart rendering
  useEffect(() => {
    if (!svgRef.current) return;
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

    // Process burst intervals
    const intervals: { pid: number; start: number; end: number; type: string }[] = [];
    simResult.events.forEach((evt, idx) => {
      if (evt.type === 'dispatch' && evt.pid !== null) {
        // Find next event for this pid
        let end = maxDuration;
        for (let j = idx + 1; j < simResult.events.length; ++j) {
          const next = simResult.events[j];
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

  }, [simResult, currentTick, maxDuration, workload]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Controls Bar */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        {/* Preset Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Workload:</span>
          {[
            { name: 'Unloaded (Empty)', data: [] },
            { name: 'Convoy Effect', data: PRESET_CONVOY },
            { name: 'SJF Benchmark', data: PRESET_SJF },
            { name: 'Starvation', data: PRESET_STARVATION },
            { name: 'Interactive Mixed', data: PRESET_INTERACTIVE }
          ].map(p => (
            <button
              key={p.name}
              onClick={() => {
                setPresetName(p.name);
                setWorkload(p.data);
                setCurrentTick(0);
                setIsPlaying(false);
              }}
              className={`btn-secondary ${presetName === p.name ? 'btn-active' : ''}`}
              style={{ fontSize: '0.78rem', padding: '5px 12px' }}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Policy Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Policy:</span>
          {(['FCFS', 'SJF', 'SRTF', 'PRIORITY', 'ROUND_ROBIN', 'MLFQ', 'CFS_LIKE'] as CpuPolicy[]).map(pol => (
            <button
              key={pol}
              onClick={() => {
                setPolicy(pol);
                setCurrentTick(0);
              }}
              className={`btn-secondary ${policy === pol ? 'btn-active' : ''}`}
              style={{ fontSize: '0.78rem', padding: '5px 10px' }}
            >
              {pol}
            </button>
          ))}

          {(policy === 'ROUND_ROBIN' || policy === 'MLFQ') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--primary-cyan)', fontWeight: 600 }}>Quantum:</span>
              <input
                type="number"
                min={1}
                max={20}
                value={quantum}
                onChange={e => setQuantum(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 50, padding: '3px 6px', fontSize: '0.78rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: '#fff' }}
              />
            </div>
          )}

          {policy === 'PRIORITY' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={preemptive}
                  onChange={e => setPreemptive(e.target.checked)}
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
                  onChange={e => setAging(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ width: 50, padding: '3px 6px', fontSize: '0.78rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: '#fff' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Left Column: Interactive D3 Gantt Replay */}
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>Interactive CPU Gantt Replay</span>
                <span className="badge badge-cyan">{policy}</span>
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: 4 }}>
                Discrete ticks ordered monotonically. Drag the scrubber or hit play to inspect process dispatches.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono-val" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-cyan)' }}>
                {currentTick} / {maxDuration}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>ticks</span>
            </div>
          </div>

          {/* D3 Canvas Container */}
          <div style={{ width: '100%', overflowX: 'auto', background: 'rgba(5, 8, 14, 0.6)', borderRadius: 'var(--radius-md)', padding: 10 }}>
            {workload.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                No simulation is loaded.
              </div>
            ) : (
              <svg ref={svgRef} style={{ width: '100%', height: 'auto', display: 'block' }}></svg>
            )}
          </div>

          {/* Time Scrubber & Replay Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn-primary"
              style={{ width: 100, justifyContent: 'center' }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              onClick={() => { setCurrentTick(0); setIsPlaying(false); }}
              className="btn-secondary"
              title="Reset to Tick 0"
            >
              <RotateCcw size={15} />
            </button>

            <button
              onClick={() => setCurrentTick(t => Math.max(0, t - 1))}
              className="btn-secondary"
              title="Step Back 1 Tick"
            >
              <SkipBack size={15} />
            </button>

            <button
              onClick={() => setCurrentTick(t => Math.min(maxDuration, t + 1))}
              className="btn-secondary"
              title="Step Forward 1 Tick"
            >
              <SkipForward size={15} />
            </button>

            {/* Slider */}
            <input
              type="range"
              min={0}
              max={maxDuration}
              value={currentTick}
              onChange={e => {
                setCurrentTick(Number(e.target.value));
                setIsPlaying(false);
              }}
              style={{ flex: 1, accentColor: 'var(--primary-cyan)', cursor: 'pointer' }}
            />

            {/* Speed Multiplier */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {[0.5, 1, 2, 5].map(spd => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`btn-secondary ${playbackSpeed === spd ? 'btn-active' : ''}`}
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Quantitative Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Metrics Card */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} color="var(--primary-cyan)" />
              Quantitative Metrics
            </h3>

            {workload.length === 0 ? (
              <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No simulation is loaded.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Avg Waiting</span>
                  <p className="mono-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                    {simResult.metrics.averages.waitingTime.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>t</span>
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Avg Turnaround</span>
                  <p className="mono-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                    {simResult.metrics.averages.turnaroundTime.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>t</span>
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Avg Response</span>
                  <p className="mono-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                    {simResult.metrics.averages.responseTime.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>t</span>
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>CPU Utilization</span>
                  <p className="mono-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: 4 }}>
                    {(simResult.metrics.cpuUtilization * 100).toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>%</span>
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Throughput</span>
                  <p className="mono-val" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                    {simResult.metrics.throughput.toFixed(3)} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>proc/t</span>
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Jain Fairness</span>
                  <p className="mono-val" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-cyan)', marginTop: 4 }}>
                    {simResult.metrics.jainFairness !== null ? simResult.metrics.jainFairness.toFixed(3) : '1.000'}
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
            {workload.length === 0 ? (
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
                  {simResult.metrics.perProcess.map(pm => (
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
    </div>
  );
};
