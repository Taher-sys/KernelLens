import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { GitCompare, Trophy, Award, Zap, HelpCircle, BarChart3, CheckCircle2 } from 'lucide-react';
import { runCpuSimulation } from '../bridge/simulationBridge';
import { CpuPolicy, ProcessSpec, SimulationResponse } from '../types/schema';

interface PolicyConfig {
  id: string;
  name: string;
  policy: CpuPolicy;
  options: {
    quantum?: number;
    preemptive?: boolean;
    agingInterval?: number;
    contextSwitchCost?: number;
  };
}

const ALL_POLICIES: PolicyConfig[] = [
  { id: 'fcfs', name: 'FCFS (First-Come First-Served)', policy: 'FCFS', options: {} },
  { id: 'sjf', name: 'SJF (Non-preemptive)', policy: 'SJF', options: { preemptive: false } },
  { id: 'srtf', name: 'SRTF (Preemptive SJF)', policy: 'SRTF', options: { preemptive: true } },
  { id: 'rr2', name: 'Round Robin (q = 2)', policy: 'ROUND_ROBIN', options: { quantum: 2 } },
  { id: 'rr4', name: 'Round Robin (q = 4)', policy: 'ROUND_ROBIN', options: { quantum: 4 } },
  { id: 'prio_np', name: 'Priority (Non-preemptive)', policy: 'PRIORITY', options: { preemptive: false } },
  { id: 'prio_p_age', name: 'Priority (Preemptive + Aging)', policy: 'PRIORITY', options: { preemptive: true, agingInterval: 5 } },
  { id: 'mlfq', name: 'MLFQ (Feedback Boost)', policy: 'MLFQ', options: { quantum: 2 } },
  { id: 'cfs', name: 'CFS-like (vruntime model)', policy: 'CFS_LIKE', options: {} }
];

const PRESETS: Record<string, { name: string; description: string; workload: ProcessSpec[] }> = {
  empty: {
    name: 'Unloaded (Empty)',
    description: 'No simulation is loaded.',
    workload: []
  },
  convoy: {
    name: 'Convoy Effect (Silberschatz)',
    description: 'One CPU-hog process (burst=24) arrives first, blocking two short processes (burst=3). Demonstrates severe FCFS convoy effect.',
    workload: [
      { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 24 }], basePriority: 0, niceValue: 0 },
      { pid: 2, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 },
      { pid: 3, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 }
    ]
  },
  interactive: {
    name: 'Interactive Mixed Bursts',
    description: 'Processes interleaving CPU bursts with I/O waits, testing preemption, response latency, and queue transitions.',
    workload: [
      { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 4 }, { kind: 'IO', duration: 3 }, { kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: -5 },
      { pid: 2, arrivalTime: 1, bursts: [{ kind: 'CPU', duration: 3 }, { kind: 'IO', duration: 4 }, { kind: 'CPU', duration: 2 }], basePriority: 2, niceValue: 0 },
      { pid: 3, arrivalTime: 3, bursts: [{ kind: 'CPU', duration: 6 }, { kind: 'IO', duration: 2 }, { kind: 'CPU', duration: 2 }], basePriority: 3, niceValue: 5 }
    ]
  },
  starvation: {
    name: 'Priority Starvation & Aging',
    description: 'Low-priority job arrives early, while high-priority streams arrive continuously. Shows aging preventing starvation.',
    workload: [
      { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 20 }], basePriority: 10, niceValue: 10 },
      { pid: 2, arrivalTime: 1, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: -10 },
      { pid: 3, arrivalTime: 5, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: -10 },
      { pid: 4, arrivalTime: 9, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: -10 },
      { pid: 5, arrivalTime: 13, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: -10 }
    ]
  },
  staggered: {
    name: 'Staggered Varied Bursts',
    description: 'Four diverse processes with non-zero arrivals to test SRTF preemption vs SJF non-preemptive lock-in.',
    workload: [
      { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 7 }], basePriority: 3, niceValue: 0 },
      { pid: 2, arrivalTime: 2, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 1, niceValue: -2 },
      { pid: 3, arrivalTime: 4, bursts: [{ kind: 'CPU', duration: 1 }], basePriority: 4, niceValue: 4 },
      { pid: 4, arrivalTime: 5, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 2, niceValue: 0 }
    ]
  }
};

export const PolicyComparison: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<string>('convoy');
  const [workload, setWorkload] = useState<ProcessSpec[]>(PRESETS.convoy.workload);
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([
    'fcfs', 'sjf', 'srtf', 'rr2', 'rr4', 'prio_p_age', 'mlfq', 'cfs'
  ]);
  const [showFormulas, setShowFormulas] = useState(false);

  const chartRef = useRef<SVGSVGElement | null>(null);

  const handleSelectPreset = (key: string) => {
    setSelectedPreset(key);
    setWorkload(PRESETS[key].workload);
  };

  const togglePolicy = (id: string) => {
    if (selectedPolicyIds.includes(id)) {
      if (selectedPolicyIds.length > 1) {
        setSelectedPolicyIds(selectedPolicyIds.filter(x => x !== id));
      }
    } else {
      setSelectedPolicyIds([...selectedPolicyIds, id]);
    }
  };

  // Run simulations for all active policies
  const comparisonResults = useMemo(() => {
    return ALL_POLICIES
      .filter(p => selectedPolicyIds.includes(p.id))
      .map(config => {
        const response: SimulationResponse = runCpuSimulation(workload, config.policy, config.options);
        return {
          config,
          response,
          metrics: response.metrics,
          duration: response.simulatedDuration
        };
      });
  }, [workload, selectedPolicyIds]);

  // Find best metrics
  const bestWaiting = useMemo(() => {
    if (comparisonResults.length === 0) return null;
    return [...comparisonResults].sort((a, b) => a.metrics.averages.waitingTime - b.metrics.averages.waitingTime)[0];
  }, [comparisonResults]);

  const bestTurnaround = useMemo(() => {
    if (comparisonResults.length === 0) return null;
    return [...comparisonResults].sort((a, b) => a.metrics.averages.turnaroundTime - b.metrics.averages.turnaroundTime)[0];
  }, [comparisonResults]);

  const bestResponse = useMemo(() => {
    if (comparisonResults.length === 0) return null;
    return [...comparisonResults].sort((a, b) => a.metrics.averages.responseTime - b.metrics.averages.responseTime)[0];
  }, [comparisonResults]);

  const bestFairness = useMemo(() => {
    if (comparisonResults.length === 0) return null;
    const withFairness = comparisonResults.filter(r => r.metrics.jainFairness !== null);
    if (withFairness.length === 0) return null;
    return [...withFairness].sort((a, b) => (b.metrics.jainFairness ?? 0) - (a.metrics.jainFairness ?? 0))[0];
  }, [comparisonResults]);

  // Render D3 Comparison Bar Chart
  useEffect(() => {
    if (!chartRef.current || comparisonResults.length === 0) return;
    const svg = d3.select(chartRef.current);
    svg.selectAll('*').remove();

    const width = 960;
    const height = 340;
    const margin = { top: 30, right: 30, bottom: 60, left: 60 };

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const metricsKeys = ['Waiting Time', 'Turnaround Time', 'Response Time'];
    const colorScale = d3.scaleOrdinal<string>()
      .domain(metricsKeys)
      .range(['#00f2fe', '#4facfe', '#818cf8']);

    const x0 = d3.scaleBand()
      .domain(comparisonResults.map(r => r.config.id))
      .range([margin.left, width - margin.right])
      .paddingInner(0.2);

    const x1 = d3.scaleBand()
      .domain(metricsKeys)
      .range([0, x0.bandwidth()])
      .padding(0.08);

    const maxVal = d3.max(comparisonResults, r => Math.max(
      r.metrics.averages.waitingTime,
      r.metrics.averages.turnaroundTime,
      r.metrics.averages.responseTime
    )) || 10;

    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.15])
      .range([height - margin.bottom, margin.top]);

    // Gridlines
    const yGrid = d3.axisLeft(y).ticks(5).tickSize(-(width - margin.left - margin.right)).tickFormat(() => '');
    svg.append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .attr('color', 'rgba(255, 255, 255, 0.05)')
      .call(yGrid);

    // Bars
    const group = svg.append('g')
      .selectAll('g')
      .data(comparisonResults)
      .enter()
      .append('g')
      .attr('transform', d => `translate(${x0(d.config.id)},0)`);

    group.selectAll('rect')
      .data(d => [
        { key: 'Waiting Time', value: d.metrics.averages.waitingTime },
        { key: 'Turnaround Time', value: d.metrics.averages.turnaroundTime },
        { key: 'Response Time', value: d.metrics.averages.responseTime }
      ])
      .enter()
      .append('rect')
      .attr('x', d => x1(d.key)!)
      .attr('y', d => y(d.value))
      .attr('width', x1.bandwidth())
      .attr('height', d => y(0) - y(d.value))
      .attr('fill', d => colorScale(d.key))
      .attr('rx', 3)
      .attr('opacity', 0.9);

    // Value Labels on top of bars
    group.selectAll('text.val')
      .data(d => [
        { key: 'Waiting Time', value: d.metrics.averages.waitingTime },
        { key: 'Turnaround Time', value: d.metrics.averages.turnaroundTime },
        { key: 'Response Time', value: d.metrics.averages.responseTime }
      ])
      .enter()
      .append('text')
      .attr('class', 'val')
      .attr('x', d => x1(d.key)! + x1.bandwidth() / 2)
      .attr('y', d => y(d.value) - 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#94a3b8')
      .text(d => d.value.toFixed(1));

    // X Axis
    const xAxis = d3.axisBottom(x0)
      .tickFormat(id => {
        const item = comparisonResults.find(r => r.config.id === id);
        return item ? item.config.name.split(' ')[0] : id;
      });

    svg.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(xAxis)
      .attr('color', '#64748b')
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', '#cbd5e1');

    // Y Axis
    const yAxis = d3.axisLeft(y).ticks(6).tickFormat(d => `${d}t`);
    svg.append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(yAxis)
      .attr('color', '#64748b')
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', '#94a3b8');

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - margin.right - 280}, ${margin.top - 12})`);

    metricsKeys.forEach((key, idx) => {
      const legG = legend.append('g').attr('transform', `translate(${idx * 96}, 0)`);
      legG.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .attr('rx', 2)
        .attr('fill', colorScale(key));
      legG.append('text')
        .attr('x', 14)
        .attr('y', 9)
        .attr('font-size', '10px')
        .attr('fill', '#cbd5e1')
        .text(key);
    });

  }, [comparisonResults]);

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitCompare size={24} color="var(--primary-cyan)" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Multi-Policy Quantitative Comparison Matrix</h1>
            <span className="badge badge-cyan">Tier 1 Core</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            Deterministic comparative evaluation across CPU algorithms executed on the exact same identical workload.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setShowFormulas(!showFormulas)}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <HelpCircle size={14} />
            <span>{showFormulas ? 'Hide Formulas' : 'View Metric Definitions'}</span>
          </button>
        </div>
      </div>

      {/* Metric Definitions Accordion */}
      {showFormulas && (
        <div className="card" style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-glow)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-cyan)', marginBottom: 12 }}>
            Formal Metric Formulations & Simulation Invariants
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, fontSize: '0.82rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8 }}>
              <strong style={{ color: 'var(--text-main)' }}>Turnaround Time (T_ta)</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                Total latency elapsed from arrival to completion: <code>T_ta = T_finish - T_arrival</code>. Reflects overall batch completion latency.
              </p>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8 }}>
              <strong style={{ color: 'var(--text-main)' }}>Waiting Time (T_w)</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                Cumulative ticks spent in the <code>READY</code> queue waiting for CPU allocation (excluding I/O wait).
              </p>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8 }}>
              <strong style={{ color: 'var(--text-main)' }}>Response Time (T_resp)</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                Latency from submission to first CPU dispatch: <code>T_resp = T_first_run - T_arrival</code>. Critical for interactive workloads.
              </p>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8 }}>
              <strong style={{ color: 'var(--text-main)' }}>Jain&apos;s Fairness Index (J)</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                <code>J = (∑ x_i)^2 / (n * ∑ x_i^2)</code> computed over continuous runnable processes, where <code>x_i</code> is CPU ticks received. Values range from <code>1/n</code> (unfair) to <code>1.0</code> (perfect equality).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Workload Presets & Policy Toggles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Preset Selector */}
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={16} color="var(--primary-cyan)" />
            Select Workload Preset
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Object.entries(PRESETS).map(([key, item]) => (
              <button
                key={key}
                onClick={() => handleSelectPreset(key)}
                className={selectedPreset === key ? 'btn-primary' : 'btn-secondary'}
                style={{ textAlign: 'left', padding: '10px 14px', height: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{item.name}</span>
                <span style={{ fontSize: '0.72rem', opacity: 0.8, fontWeight: 400 }}>
                  {item.workload.length} processes ({item.workload.map(p => `P${p.pid}`).join(', ')})
                </span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10, fontStyle: 'italic' }}>
            {PRESETS[selectedPreset]?.description}
          </p>
        </div>

        {/* Policy Active Toggles */}
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color="var(--primary-cyan)" />
            Compare Algorithms ({selectedPolicyIds.length} active)
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_POLICIES.map(pol => {
              const isActive = selectedPolicyIds.includes(pol.id);
              return (
                <button
                  key={pol.id}
                  onClick={() => togglePolicy(pol.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    background: isActive ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: isActive ? '1px solid var(--border-glow)' : '1px solid var(--border-subtle)',
                    color: isActive ? 'var(--primary-cyan)' : 'var(--text-muted)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {pol.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results or Empty State */}
      {workload.length === 0 ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem', fontStyle: 'italic' }}>
          No simulation is loaded.
        </div>
      ) : (
        <>
          {/* Best-in-Class Delta Winner Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div className="card" style={{ borderLeft: '4px solid #00f2fe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                <Trophy size={14} color="#00f2fe" />
                <span>LOWEST WAITING TIME</span>
              </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
            {bestWaiting?.metrics.averages.waitingTime.toFixed(2)} <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>ticks</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#00f2fe', fontWeight: 600, marginTop: 2 }}>
            {bestWaiting?.config.name}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #4facfe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <Trophy size={14} color="#4facfe" />
            <span>LOWEST TURNAROUND TIME</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
            {bestTurnaround?.metrics.averages.turnaroundTime.toFixed(2)} <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>ticks</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#4facfe', fontWeight: 600, marginTop: 2 }}>
            {bestTurnaround?.config.name}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #818cf8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <Trophy size={14} color="#818cf8" />
            <span>BEST RESPONSE LATENCY</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
            {bestResponse?.metrics.averages.responseTime.toFixed(2)} <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>ticks</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600, marginTop: 2 }}>
            {bestResponse?.config.name}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #38ef7d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <Trophy size={14} color="#38ef7d" />
            <span>HIGHEST JAIN FAIRNESS</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
            {bestFairness?.metrics.jainFairness !== null && bestFairness?.metrics.jainFairness !== undefined
              ? bestFairness.metrics.jainFairness.toFixed(3)
              : 'N/A'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#38ef7d', fontWeight: 600, marginTop: 2 }}>
            {bestFairness?.config.name}
          </div>
        </div>
      </div>

      {/* D3 Graphical Visualization */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={18} color="var(--primary-cyan)" />
            Comparative Metrics Bar Visualization
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Lower values represent superior latency performance</span>
        </div>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg ref={chartRef} style={{ width: '100%', minWidth: 800, display: 'block' }} />
        </div>
      </div>

      {/* Quantitative Summary Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Quantitative Policy Matrix & Deltas</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px' }}>Policy</th>
              <th style={{ padding: '10px 12px' }}>Avg Waiting (W_avg)</th>
              <th style={{ padding: '10px 12px' }}>Avg Turnaround (T_avg)</th>
              <th style={{ padding: '10px 12px' }}>Avg Response (R_avg)</th>
              <th style={{ padding: '10px 12px' }}>Throughput (μ)</th>
              <th style={{ padding: '10px 12px' }}>CPU Utilization</th>
              <th style={{ padding: '10px 12px' }}>Context Switches</th>
              <th style={{ padding: '10px 12px' }}>Jain Fairness</th>
            </tr>
          </thead>
          <tbody>
            {comparisonResults.map(res => {
              const isBestW = bestWaiting?.config.id === res.config.id;
              const isBestT = bestTurnaround?.config.id === res.config.id;
              const isBestR = bestResponse?.config.id === res.config.id;

              return (
                <tr
                  key={res.config.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: isBestT ? 'rgba(79, 172, 254, 0.05)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {res.config.name}
                      {isBestT && <CheckCircle2 size={14} color="var(--primary-cyan)" />}
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: isBestW ? '#00f2fe' : 'var(--text-main)', fontWeight: isBestW ? 800 : 500 }}>
                    {res.metrics.averages.waitingTime.toFixed(2)}t
                    {isBestW && <span className="badge badge-cyan" style={{ marginLeft: 6, fontSize: '0.65rem' }}>Min</span>}
                  </td>
                  <td style={{ padding: '12px', color: isBestT ? '#4facfe' : 'var(--text-main)', fontWeight: isBestT ? 800 : 500 }}>
                    {res.metrics.averages.turnaroundTime.toFixed(2)}t
                    {isBestT && <span className="badge badge-cyan" style={{ marginLeft: 6, fontSize: '0.65rem' }}>Min</span>}
                  </td>
                  <td style={{ padding: '12px', color: isBestR ? '#818cf8' : 'var(--text-main)', fontWeight: isBestR ? 800 : 500 }}>
                    {res.metrics.averages.responseTime.toFixed(2)}t
                    {isBestR && <span className="badge badge-cyan" style={{ marginLeft: 6, fontSize: '0.65rem' }}>Min</span>}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                    {(res.metrics.throughput * 100).toFixed(1)} / 100t
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                    {(res.metrics.cpuUtilization * 100).toFixed(1)}%
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                    {res.metrics.contextSwitches}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                    {res.metrics.jainFairness !== null ? res.metrics.jainFairness.toFixed(3) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  )}
    </div>
  );
};
