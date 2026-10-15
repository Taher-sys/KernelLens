import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, Layers, CheckSquare, Square } from 'lucide-react';
import { ProcessSpec, CpuPolicy } from '../../bridge/schema';
import { defaultEngineBridge, SUPPORTED_CPU_POLICIES } from '../../bridge/engineBridge';
import { MetricDeltaTable, PolicyRunResult } from './MetricDeltaTable';
import { GanttTimeline } from '../cpu/GanttTimeline';

interface CompareViewProps {
  workload?: ProcessSpec[];
  quantum?: number;
  seed?: number;
  reducedMotion?: boolean;
}

export const CompareView: React.FC<CompareViewProps> = ({
  workload = [
    { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 24 }], basePriority: 0, niceValue: 0 },
    { pid: 2, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 },
    { pid: 3, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 }
  ],
  quantum = 3,
  seed = 42,
  reducedMotion = false
}) => {
  // Selected policies to execute concurrently
  const [selectedPolicies, setSelectedPolicies] = useState<CpuPolicy[]>([
    'FCFS',
    'SJF',
    'SRTF',
    'ROUND_ROBIN',
    'PRIORITY'
  ]);

  const [results, setResults] = useState<PolicyRunResult[]>([]);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronized Multi-Policy Playhead
  const [currentTick, setCurrentTick] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Maximum duration across all compared policies
  const maxSimDuration = results.reduce(
    (max, r) => Math.max(max, r.response.simulatedDuration),
    0
  );

  // Execute all selected policies on the exact identical workload and seed
  const runComparison = async () => {
    if (selectedPolicies.length === 0 || workload.length === 0) return;

    setIsExecuting(true);
    setError(null);
    setCurrentTick(0);
    setIsPlaying(false);

    try {
      const runs: PolicyRunResult[] = [];

      for (const pol of selectedPolicies) {
        const response = await defaultEngineBridge.run({
          schemaVersion: 1,
          runId: `compare-${pol.toLowerCase()}-seed${seed}`,
          seed,
          module: 'cpu',
          policy: {
            name: pol,
            quantum
          },
          workload: {
            processes: workload
          },
          options: {
            quantum,
            preemptive: pol === 'SRTF' || pol === 'PRIORITY',
            agingInterval: pol === 'PRIORITY' ? 5 : 0
          }
        });

        runs.push({
          policy: pol,
          name: pol,
          response
        });
      }

      setResults(runs);
    } catch (err: any) {
      setError(err.message || 'Comparison execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  // Run on mount or when dependencies change
  useEffect(() => {
    runComparison();
  }, [workload, quantum, seed]);

  // Synchronized playback loop
  useEffect(() => {
    if (!isPlaying || maxSimDuration === 0) return;
    const intervalTime = Math.max(40, Math.floor(400 / playbackSpeed));
    const timer = setInterval(() => {
      setCurrentTick((t) => {
        if (t >= maxSimDuration) {
          setIsPlaying(false);
          return maxSimDuration;
        }
        return t + 1;
      });
    }, intervalTime);
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, maxSimDuration]);

  // Toggle policy selection
  const handleTogglePolicy = (policy: CpuPolicy) => {
    if (selectedPolicies.includes(policy)) {
      if (selectedPolicies.length > 1) {
        setSelectedPolicies(selectedPolicies.filter((p) => p !== policy));
      }
    } else {
      setSelectedPolicies([...selectedPolicies, policy]);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        width: '100%',
        padding: '16px'
      }}
      role="region"
      aria-label="Multi-Policy Comparative Analysis"
    >
      {error && (
        <div
          style={{
            color: '#ef4444',
            background: 'rgba(239, 68, 68, 0.1)',
            padding: '8px 12px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '2px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)'
          }}
        >
          {error}
        </div>
      )}

      {/* Comparative Mission Control Header */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Layers size={16} color="var(--primary-cyan)" />
          <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            MULTI-POLICY COMPARISON LAB
          </span>
          <span className="badge badge-cyan">IDENTICAL WORKLOAD & SEED {seed}</span>
        </div>

        {/* Policy Checkboxes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
            POLICIES:
          </span>
          {SUPPORTED_CPU_POLICIES.map((p) => {
            const isSelected = selectedPolicies.includes(p);
            return (
              <button
                key={p}
                onClick={() => handleTogglePolicy(p)}
                className={`btn-secondary ${isSelected ? 'btn-active' : ''}`}
                style={{ padding: '3px 7px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}
                aria-label={`Toggle ${p}`}
              >
                {isSelected ? <CheckSquare size={11} /> : <Square size={11} />}
                <span>{p}</span>
              </button>
            );
          })}
          <button
            onClick={runComparison}
            disabled={isExecuting}
            className="btn-primary"
            style={{ padding: '3px 10px', fontSize: '11px', marginLeft: 4 }}
          >
            {isExecuting ? 'Running...' : 'Re-Run'}
          </button>
        </div>
      </div>

      {/* Synchronized Playhead Deck */}
      {results.length > 0 && maxSimDuration > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn-primary"
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                background: isPlaying ? '#d69e2e' : '#0284c7'
              }}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            <button
              onClick={() => {
                setCurrentTick(0);
                setIsPlaying(false);
              }}
              className="btn-secondary"
              title="Reset comparison playhead"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              <RotateCcw size={12} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <Clock size={13} color="var(--primary-cyan)" />
              <span style={{ color: 'var(--text-subtle)' }}>SYNCHRONIZED TICK:</span>
              <span style={{ color: 'var(--primary-cyan)', fontWeight: 700 }}>{currentTick}</span>
              <span style={{ color: 'var(--text-subtle)' }}>/ {maxSimDuration}</span>
            </div>
          </div>

          {/* Time Scrubber */}
          <div style={{ flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="range"
              min={0}
              max={maxSimDuration}
              value={currentTick}
              onChange={(e) => {
                setCurrentTick(Number(e.target.value));
                setIsPlaying(false);
              }}
              style={{ width: '100%', accentColor: 'var(--primary-cyan)' }}
              aria-label="Synchronized Comparison Timeline Scrubber"
            />
          </div>

          {/* Speed Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {[0.5, 1, 2, 4].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`btn-secondary ${playbackSpeed === spd ? 'btn-active' : ''}`}
                style={{ padding: '2px 6px', fontSize: '10px' }}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantitative Metric Delta Board */}
      <MetricDeltaTable results={results} />

      {/* Dual / Multi-Gantt Alignment: Aligned timelines sharing global x-axis */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--primary-cyan)' }}>
          SYNCHRONIZED GANTT TRACES ({results.length} POLICIES):
        </div>

        {results.map((r) => (
          <div
            key={r.policy}
            className="glass-panel"
            style={{
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                POLICY: {r.policy}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                Duration: {r.response.simulatedDuration}t | Context Switches: {r.response.metrics.contextSwitches} | Avg Wait: {r.response.metrics.averages.waitingTime.toFixed(2)}t
              </span>
            </div>

            <GanttTimeline
              events={r.response.events}
              processes={workload}
              currentTick={currentTick}
              maxTick={maxSimDuration}
              quantum={quantum}
              reducedMotion={reducedMotion}
              onScrub={(t) => setCurrentTick(t)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
