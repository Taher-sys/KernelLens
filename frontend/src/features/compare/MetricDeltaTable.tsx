import React, { useState } from 'react';
import { Award, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { SimulationResponse, CpuPolicy } from '../../bridge/schema';

export interface PolicyRunResult {
  policy: CpuPolicy;
  name: string;
  response: SimulationResponse;
}

interface MetricDeltaTableProps {
  results: PolicyRunResult[];
}

export const MetricDeltaTable: React.FC<MetricDeltaTableProps> = ({ results }) => {
  // Baseline policy for differential readouts (defaults to first policy, e.g., FCFS)
  const [baselinePolicy, setBaselinePolicy] = useState<string>(
    results.length > 0 ? results[0].policy : 'FCFS'
  );

  if (results.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-subtle)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          background: 'var(--surface-subpanel)',
          borderRadius: 'var(--radius-sm)'
        }}
      >
        No policy results loaded for comparison.
      </div>
    );
  }

  // Find baseline run
  const baselineResult =
    results.find((r) => r.policy === baselinePolicy) || results[0];
  const bMetrics = baselineResult.response.metrics;

  // Compute best-in-class winners
  let minWait = Infinity;
  let minTurnaround = Infinity;
  let maxFairness = -Infinity;
  let winnerWait: string | null = null;
  let winnerTurnaround: string | null = null;
  let winnerFairness: string | null = null;

  results.forEach((r) => {
    const avgWait = r.response.metrics.averages.waitingTime;
    const avgTurn = r.response.metrics.averages.turnaroundTime;
    const fair = r.response.metrics.jainFairness ?? 0;

    if (avgWait < minWait) {
      minWait = avgWait;
      winnerWait = r.policy;
    }
    if (avgTurn < minTurnaround) {
      minTurnaround = avgTurn;
      winnerTurnaround = r.policy;
    }
    if (fair > maxFairness) {
      maxFairness = fair;
      winnerFairness = r.policy;
    }
  });

  // Helper for delta formatting:
  // isLowerBetter: true for waiting/turnaround/switches, false for throughput/fairness/utilization
  const renderDelta = (val: number, baseVal: number, unit: string = '', isLowerBetter: boolean = true) => {
    const delta = val - baseVal;
    if (Math.abs(delta) < 0.0001) {
      return (
        <span style={{ color: 'var(--text-subtle)', fontSize: '10px' }}>
          <Minus size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> baseline
        </span>
      );
    }

    const isPositiveOutcome = isLowerBetter ? delta < 0 : delta > 0;
    const color = isPositiveOutcome ? 'var(--telemetry-emerald, #10b981)' : 'var(--telemetry-amber, #f59e0b)';
    const Icon = delta < 0 ? ArrowDown : ArrowUp;
    const sign = delta > 0 ? '+' : '';

    return (
      <span style={{ color, fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
        <Icon size={10} />
        <span>{sign}{delta.toFixed(2)}{unit}</span>
      </span>
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
        overflowX: 'auto'
      }}
      role="region"
      aria-label="Comparative Analytics & Delta Matrix"
    >
      {/* Header & Baseline Picker */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Award size={15} color="var(--primary-cyan)" />
          <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            QUANTITATIVE METRIC DELTA BOARD
          </span>
          <span className="badge badge-cyan">{results.length} POLICIES COMPARED</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--text-subtle)' }}>BASELINE FOR DELTAS:</span>
          <select
            value={baselinePolicy}
            onChange={(e) => setBaselinePolicy(e.target.value)}
            style={{
              background: 'var(--surface-subpanel)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--primary-cyan)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              padding: '3px 6px'
            }}
            aria-label="Select baseline policy for delta calculation"
          >
            {results.map((r) => (
              <option key={r.policy} value={r.policy}>
                {r.policy}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Best-in-Class Winners Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px'
        }}
      >
        <div style={{ padding: '6px 10px', background: 'rgba(0, 163, 137, 0.1)', border: '1px solid rgba(0, 163, 137, 0.3)', borderRadius: '2px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-subtle)' }}>★ Lowest Waiting:</span>
          <span style={{ color: '#00a389', fontWeight: 700 }}>{winnerWait} ({minWait.toFixed(2)}t)</span>
        </div>
        <div style={{ padding: '6px 10px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '2px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-subtle)' }}>★ Lowest Turnaround:</span>
          <span style={{ color: '#38bdf8', fontWeight: 700 }}>{winnerTurnaround} ({minTurnaround.toFixed(2)}t)</span>
        </div>
        <div style={{ padding: '6px 10px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '2px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-subtle)' }}>★ Highest Fairness:</span>
          <span style={{ color: '#c084fc', fontWeight: 700 }}>{winnerFairness} ({maxFairness.toFixed(3)})</span>
        </div>
      </div>

      {/* Full Quantitative Metrics & Deltas Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          textAlign: 'left'
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-strong)', color: 'var(--text-subtle)' }}>
            <th style={{ padding: '8px 6px' }}>POLICY</th>
            <th style={{ padding: '8px 6px' }}>AVG WAITING</th>
            <th style={{ padding: '8px 6px' }}>AVG TURNAROUND</th>
            <th style={{ padding: '8px 6px' }}>AVG RESPONSE</th>
            <th style={{ padding: '8px 6px' }}>CPU UTIL</th>
            <th style={{ padding: '8px 6px' }}>SWITCHES</th>
            <th style={{ padding: '8px 6px' }}>THROUGHPUT</th>
            <th style={{ padding: '8px 6px' }}>JAIN FAIRNESS</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const m = r.response.metrics;
            const isBase = r.policy === baselinePolicy;

            return (
              <tr
                key={r.policy}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: isBase ? 'rgba(56, 189, 248, 0.04)' : 'transparent'
                }}
              >
                {/* Policy Name */}
                <td style={{ padding: '8px 6px', fontWeight: 700, color: 'var(--text-main)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{r.policy}</span>
                    {isBase && <span style={{ fontSize: '9px', color: '#38bdf8' }}>[BASE]</span>}
                    {r.policy === winnerWait && <span title="Lowest Waiting Time" style={{ color: '#00a389' }}>★</span>}
                  </div>
                </td>

                {/* Avg Waiting Time */}
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{m.averages.waitingTime.toFixed(2)}t</span>
                    {!isBase && renderDelta(m.averages.waitingTime, bMetrics.averages.waitingTime, 't', true)}
                  </div>
                </td>

                {/* Avg Turnaround Time */}
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{m.averages.turnaroundTime.toFixed(2)}t</span>
                    {!isBase && renderDelta(m.averages.turnaroundTime, bMetrics.averages.turnaroundTime, 't', true)}
                  </div>
                </td>

                {/* Avg Response Time */}
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{m.averages.responseTime.toFixed(2)}t</span>
                    {!isBase && renderDelta(m.averages.responseTime, bMetrics.averages.responseTime, 't', true)}
                  </div>
                </td>

                {/* CPU Utilization */}
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{(m.cpuUtilization * 100).toFixed(1)}%</span>
                    {!isBase && renderDelta(m.cpuUtilization * 100, bMetrics.cpuUtilization * 100, '%', false)}
                  </div>
                </td>

                {/* Context Switches */}
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{m.contextSwitches}</span>
                    {!isBase && renderDelta(m.contextSwitches, bMetrics.contextSwitches, '', true)}
                  </div>
                </td>

                {/* Throughput */}
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{m.throughput.toFixed(3)}/t</span>
                    {!isBase && renderDelta(m.throughput, bMetrics.throughput, '/t', false)}
                  </div>
                </td>

                {/* Jain Fairness */}
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>
                      {m.jainFairness !== null ? m.jainFairness.toFixed(3) : 'N/A'}
                    </span>
                    {!isBase && m.jainFairness !== null && bMetrics.jainFairness !== null &&
                      renderDelta(m.jainFairness, bMetrics.jainFairness, '', false)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
