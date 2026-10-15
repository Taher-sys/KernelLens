import React, { useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Gauge,
  Clock,
  Layers,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Keyboard
} from 'lucide-react';
import { ReplayState, ReplayAction } from '../../bridge/schema';

interface ReplayControlsProps {
  state: ReplayState;
  dispatch: React.Dispatch<ReplayAction>;
  className?: string;
  runId?: string;
  policyName?: string;
  onOpenKeyboardHelp?: () => void;
  extraControls?: React.ReactNode;
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  state,
  dispatch,
  className = '',
  runId,
  policyName,
  onOpenKeyboardHelp,
  extraControls
}) => {
  const isPlaying = state.status === 'playing';
  const isLoading = state.loading || state.status === 'loading';
  const hasError = !!state.error || state.status === 'error';

  const speedOptions = [0.25, 0.5, 1, 2, 4];

  // Global Keyboard Shortcuts (docs/ux-system.md Section 5.1)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        dispatch({ type: isPlaying ? 'PAUSE' : 'PLAY' });
      } else if (e.code === 'ArrowRight' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'STEP_FORWARD' });
      } else if (e.code === 'ArrowLeft' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'STEP_BACKWARD' });
      } else if (e.code === 'Home') {
        e.preventDefault();
        dispatch({ type: 'RESET' });
      } else if (e.code === 'End') {
        e.preventDefault();
        dispatch({ type: 'SCRUB_TO_TICK', payload: { tick: state.maxTick } });
      }
    },
    [dispatch, isPlaying, state.maxTick]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={`replay-controls-card ${className}`}
      style={{
        background: 'var(--surface-panel, #12151a)',
        border: '1px solid var(--border-subtle, #1f242d)',
        borderRadius: 'var(--radius-sm, 2px)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}
      role="region"
      aria-label="Simulation Master Deck"
    >
      {/* Top Row: Subsystem Status, Telemetry & Schema Badges */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status Badge */}
          <span
            className="badge"
            style={{
              background: isLoading
                ? 'rgba(56, 189, 248, 0.15)'
                : hasError
                ? 'rgba(239, 68, 68, 0.15)'
                : isPlaying
                ? 'rgba(0, 163, 137, 0.2)'
                : state.status === 'completed'
                ? 'rgba(168, 85, 247, 0.2)'
                : 'var(--surface-subpanel, #181d24)',
              color: isLoading
                ? '#38bdf8'
                : hasError
                ? '#ef4444'
                : isPlaying
                ? '#00a389'
                : state.status === 'completed'
                ? '#c084fc'
                : 'var(--text-subtle, #94a3b8)',
              border: `1px solid ${
                isLoading
                  ? 'rgba(56, 189, 248, 0.4)'
                  : hasError
                  ? 'rgba(239, 68, 68, 0.4)'
                  : isPlaying
                  ? 'rgba(0, 163, 137, 0.4)'
                  : 'var(--border-strong, #2d3542)'
              }`
            }}
          >
            {isLoading && <Loader2 size={11} className="spin" />}
            {hasError && <AlertCircle size={11} />}
            {state.status.toUpperCase()}
          </span>

          {policyName && (
            <span
              className="badge"
              style={{
                background: 'var(--surface-subpanel, #181d24)',
                color: 'var(--text-main, #f8fafc)',
                border: '1px solid var(--border-strong, #2d3542)'
              }}
            >
              POLICY: {policyName}
            </span>
          )}

          {/* Schema Version Guard Badge */}
          <span
            className="badge"
            title="Contract verified: schemaVersion 1 strictly enforced"
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.3)'
            }}
          >
            <ShieldCheck size={11} />
            v{state.schemaVersion}
          </span>

          {/* Checkpoint telemetry */}
          <span
            className="badge"
            title="Deterministic state reconstruction: Scrubbing backward restores nearest snapshot and replays forward"
            style={{
              background: 'rgba(99, 102, 241, 0.1)',
              color: '#818cf8',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}
          >
            <Layers size={11} />
            {state.checkpoints.length} Snapshots
          </span>

          {runId && (
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-subtle, #64748b)'
              }}
            >
              RUN: {runId}
            </span>
          )}
        </div>

        {/* Discrete Tick Telemetry Readout */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-main, #f8fafc)'
          }}
        >
          <Clock size={13} color="var(--primary-cyan, #00f2fe)" />
          <span>TICK:</span>
          <span style={{ color: 'var(--primary-cyan, #00f2fe)' }}>{state.currentTick}</span>
          <span style={{ color: 'var(--text-subtle, #64748b)' }}>/</span>
          <span>{state.maxTick}</span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-subtle, #64748b)',
              fontWeight: 400
            }}
          >
            ({state.activeEvents.length} events)
          </span>

          {onOpenKeyboardHelp && (
            <button
              onClick={onOpenKeyboardHelp}
              title="View Keyboard Navigation Shortcuts"
              className="btn-secondary"
              style={{ padding: '2px 6px', fontSize: '11px' }}
              aria-label="Keyboard Shortcuts"
            >
              <Keyboard size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Error Alert if Present */}
      {hasError && (
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm, 2px)',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '11px',
            fontFamily: 'var(--font-mono, monospace)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <AlertCircle size={14} color="#ef4444" />
          <span>{state.error || 'Simulation execution fault encountered'}</span>
        </div>
      )}

      {/* Timeline Scrubber */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <input
          type="range"
          min={0}
          max={Math.max(1, state.maxTick)}
          value={state.currentTick}
          disabled={isLoading || state.events.length === 0}
          onChange={(e) =>
            dispatch({
              type: 'SCRUB_TO_TICK',
              payload: { tick: Number(e.target.value) }
            })
          }
          style={{
            width: '100%',
            accentColor: 'var(--primary-cyan, #00f2fe)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            height: '6px'
          }}
          aria-label="Simulation Timeline Scrubber"
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '9px',
            color: 'var(--text-subtle, #64748b)'
          }}
        >
          <span>T=0 (Admission)</span>
          <span>Forward / Backward Deterministic Snapshot Replay</span>
          <span>T={state.maxTick} (Termination)</span>
        </div>
      </div>

      {/* Master Simulation Deck Controls: Step Back, Play/Pause, Step Fwd, Reset, Speeds */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Step Backward (from checkpoint) */}
          <button
            onClick={() => dispatch({ type: 'STEP_BACKWARD' })}
            disabled={isLoading || state.currentTick <= 0}
            className="btn-secondary"
            title="Step Backward (ArrowLeft / Reconstructs state from nearest snapshot)"
            style={{ padding: '5px 9px', fontSize: '11px' }}
            aria-label="Step Backward"
          >
            <SkipBack size={13} />
            <span>Prev</span>
          </button>

          {/* Play / Pause Toggle */}
          <button
            onClick={() => dispatch({ type: isPlaying ? 'PAUSE' : 'PLAY' })}
            disabled={isLoading || state.events.length === 0}
            className="btn-primary"
            style={{
              padding: '5px 14px',
              fontSize: '11px',
              background: isPlaying ? '#d69e2e' : '#0284c7',
              borderColor: isPlaying ? 'rgba(214, 158, 46, 0.4)' : 'rgba(56, 189, 248, 0.4)'
            }}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          {/* Step Forward */}
          <button
            onClick={() => dispatch({ type: 'STEP_FORWARD' })}
            disabled={isLoading || state.currentTick >= state.maxTick}
            className="btn-secondary"
            title="Step Forward (ArrowRight)"
            style={{ padding: '5px 9px', fontSize: '11px' }}
            aria-label="Step Forward"
          >
            <span>Next</span>
            <SkipForward size={13} />
          </button>

          {/* Reset to Tick 0 */}
          <button
            onClick={() => dispatch({ type: 'RESET' })}
            disabled={isLoading || state.currentTick === 0}
            className="btn-secondary"
            title="Reset to Tick 0 (Home)"
            style={{ padding: '5px 8px', fontSize: '11px' }}
            aria-label="Reset simulation"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Speed Multiplier Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Gauge size={13} color="var(--text-subtle, #94a3b8)" />
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-subtle, #94a3b8)',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 600
            }}
          >
            SPEED:
          </span>
          <div style={{ display: 'flex', gap: '2px' }}>
            {speedOptions.map((spd) => (
              <button
                key={spd}
                onClick={() => dispatch({ type: 'SET_SPEED', payload: { speed: spd } })}
                className={`btn-secondary ${state.playbackSpeed === spd ? 'btn-active' : ''}`}
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono, monospace)'
                }}
                aria-label={`Set speed ${spd}x`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Optional Extra Subsystem Actions */}
        {extraControls}
      </div>
    </div>
  );
};
