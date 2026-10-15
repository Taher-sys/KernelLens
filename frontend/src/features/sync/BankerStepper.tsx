import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  ArrowRight,
  AlertOctagon,
  Layers
} from 'lucide-react';
import {
  GOLDEN_BANKER_SILBERSCHATZ,
  BankerScenarioData
} from '../../bridge/syncGoldenData';

interface BankerStepperProps {
  scenario?: BankerScenarioData;
}

export const BankerStepper: React.FC<BankerStepperProps> = ({
  scenario = GOLDEN_BANKER_SILBERSCHATZ
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeRequestTab, setActiveRequestTab] = useState<'initial' | 'req1' | 'req2' | 'req3'>('initial');

  const maxSteps = scenario.steps.length - 1;
  const currentStep = scenario.steps[currentStepIndex];

  // Step navigation helpers
  const handleNext = useCallback(() => {
    setCurrentStepIndex(prev => Math.min(prev + 1, maxSteps));
  }, [maxSteps]);

  const handlePrev = useCallback(() => {
    setCurrentStepIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const handleReset = useCallback(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  }, []);

  // Keyboard navigation: ArrowRight / ArrowLeft / Space / Home
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Avoid hijacking if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleReset();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleReset]);

  // Autoplay timer
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentStepIndex(prev => {
        if (prev >= maxSteps) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1400);

    return () => clearInterval(timer);
  }, [isPlaying, maxSteps]);

  // Request inspection events
  const reqEvents = scenario.events;
  const initialSafetyEvent = reqEvents.find(e => e.type === 'banker_safety_checked');
  const req1Event = reqEvents.find(e => e.time === 10);
  const req2Event = reqEvents.find(e => e.time === 20);
  const req3Event = reqEvents.find(e => e.time === 30);

  return (
    <div
      className="glass-panel"
      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}
      role="region"
      aria-label="Banker's Algorithm Safe-Sequence Stepper"
      tabIndex={0}
    >
      {/* Header and Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} color="var(--primary-cyan)" />
            Banker’s Algorithm Safe-Sequence Stepper
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: 2 }}>
            Deterministic execution replay of safety verification from C++ engine events.
          </p>
        </div>

        {/* Stepper Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleReset}
            className="btn-secondary"
            title="Reset (Home)"
            aria-label="Reset sequence to step 0"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="btn-secondary"
            title="Previous step (ArrowLeft)"
            aria-label="Previous step"
          >
            <SkipBack size={14} />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="btn-primary"
            title="Play/Pause (Space)"
            aria-label={isPlaying ? 'Pause auto-stepper' : 'Play auto-stepper'}
            style={{ minWidth: 90, justifyContent: 'center' }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span style={{ marginLeft: 4 }}>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            onClick={handleNext}
            disabled={currentStepIndex === maxSteps}
            className="btn-secondary"
            title="Next step (ArrowRight)"
            aria-label="Next step"
          >
            <SkipForward size={14} />
          </button>
        </div>
      </div>

      {/* Sequence Timeline & Work Vector Banner */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              Step {currentStepIndex} of {maxSteps}:
            </span>
            <span className="badge badge-cyan" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
              {currentStepIndex === 0 ? 'Initial State' : `Process P${currentStep.currentPid} Finishes & Releases`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>Available / Work Vector:</span>
            <span
              data-testid="banker-work-vector"
              className="badge mono-val"
              style={{
                fontSize: '0.9rem',
                fontWeight: 800,
                background: 'rgba(0, 242, 254, 0.15)',
                color: 'var(--primary-cyan)',
                border: '1px solid rgba(0, 242, 254, 0.4)'
              }}
            >
              [{currentStep.workAfter.join(', ')}]
            </span>
          </div>
        </div>

        {/* Step Progress Sequence Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          <div
            onClick={() => setCurrentStepIndex(0)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: currentStepIndex === 0 ? 'var(--primary-cyan)' : 'rgba(255,255,255,0.05)',
              color: currentStepIndex === 0 ? '#000' : 'var(--text-muted)',
              transition: 'all 0.2s ease'
            }}
          >
            Start
          </div>
          {scenario.safeSequence.map((pid, idx) => {
            const stepNum = idx + 1;
            const isCurrent = currentStepIndex === stepNum;
            const isCompleted = currentStepIndex > stepNum;

            return (
              <React.Fragment key={pid}>
                <ArrowRight size={14} color="var(--text-subtle)" style={{ flexShrink: 0 }} />
                <div
                  onClick={() => setCurrentStepIndex(stepNum)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: isCurrent
                      ? 'var(--primary-cyan)'
                      : isCompleted
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: isCurrent
                      ? '#000'
                      : isCompleted
                      ? 'var(--accent-emerald)'
                      : 'var(--text-muted)',
                    border: isCurrent
                      ? '1px solid #fff'
                      : isCompleted
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid transparent',
                    boxShadow: isCurrent ? '0 0 12px rgba(0, 242, 254, 0.5)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isCompleted && <CheckCircle size={12} color="var(--accent-emerald)" />}
                  <span>P{pid}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Process Allocation, Max Claim & Need Matrix Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          Resource Allocation & Need Matrix (At Step {currentStepIndex})
        </h4>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-subtle)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Process</th>
                <th style={{ padding: '10px 14px' }}>Allocation [A, B, C]</th>
                <th style={{ padding: '10px 14px' }}>Max Claim [A, B, C]</th>
                <th style={{ padding: '10px 14px' }}>Remaining Need [A, B, C]</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {currentStep.processes.map(p => {
                const isRunning = currentStep.currentPid === p.pid;
                const isFinished = p.finished;

                return (
                  <tr
                    key={p.pid}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                      background: isRunning
                        ? 'rgba(0, 242, 254, 0.1)'
                        : isFinished
                        ? 'rgba(16, 185, 129, 0.04)'
                        : 'transparent',
                      transition: 'background 0.3s ease'
                    }}
                  >
                    <td style={{
                      padding: '12px 14px',
                      textAlign: 'left',
                      fontWeight: 800,
                      color: isRunning ? 'var(--primary-cyan)' : isFinished ? 'var(--accent-emerald)' : '#fff'
                    }}>
                      P{p.pid}
                    </td>
                    <td className="mono-val" style={{ padding: '12px 14px' }}>
                      [{p.allocation.join(', ')}]
                    </td>
                    <td className="mono-val" style={{ padding: '12px 14px' }}>
                      [{p.max.join(', ')}]
                    </td>
                    <td className="mono-val" style={{ padding: '12px 14px', color: 'var(--accent-amber)', fontWeight: 700 }}>
                      [{p.need.join(', ')}]
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {isRunning ? (
                        <span className="badge badge-cyan" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                          Executing & Releasing
                        </span>
                      ) : isFinished ? (
                        <span className="badge badge-emerald" style={{ fontSize: '0.72rem' }}>
                          <CheckCircle size={10} style={{ marginRight: 4 }} /> Finished
                        </span>
                      ) : (
                        <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-subtle)' }}>
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Engine Request Evaluator & Blocked-Process Inspector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertOctagon size={16} color="var(--accent-amber)" />
          Engine Request Evaluator & Blocked Process Inspector
        </h4>

        {/* Request selector tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveRequestTab('initial')}
            className={`btn-secondary ${activeRequestTab === 'initial' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.75rem' }}
          >
            Initial Safety Evaluation
          </button>
          <button
            onClick={() => setActiveRequestTab('req1')}
            className={`btn-secondary ${activeRequestTab === 'req1' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.75rem' }}
          >
            P1: Request [1, 0, 2] (Granted)
          </button>
          <button
            onClick={() => setActiveRequestTab('req2')}
            className={`btn-secondary ${activeRequestTab === 'req2' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.75rem', borderColor: activeRequestTab === 'req2' ? 'var(--accent-crimson)' : undefined }}
          >
            P4: Request [3, 3, 0] (Blocked)
          </button>
          <button
            onClick={() => setActiveRequestTab('req3')}
            className={`btn-secondary ${activeRequestTab === 'req3' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.75rem', borderColor: activeRequestTab === 'req3' ? 'var(--accent-crimson)' : undefined }}
          >
            P0: Request [0, 2, 0] (Blocked / Unsafe)
          </button>
        </div>

        {/* Inspection Details Panel */}
        {activeRequestTab === 'initial' && initialSafetyEvent && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={18} color="var(--accent-emerald)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                INITIAL STATE IS SAFE
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {initialSafetyEvent.details.explanation}
            </p>
          </div>
        )}

        {activeRequestTab === 'req1' && req1Event && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={18} color="var(--accent-emerald)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  REQUEST GRANTED SAFELY
                </span>
              </div>
              <span className="mono-val badge badge-cyan">Process P1</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {req1Event.details.reason}
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', display: 'flex', gap: 16 }}>
              <span>Requested: <strong style={{ color: '#fff' }}>[1, 0, 2]</strong></span>
              <span>Available: <strong style={{ color: '#fff' }}>[3, 3, 2]</strong></span>
              <span>Need: <strong style={{ color: '#fff' }}>[1, 2, 2]</strong></span>
            </div>
          </div>
        )}

        {activeRequestTab === 'req2' && req2Event && (
          <div
            data-testid="blocked-process-req2"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <XCircle size={20} color="var(--accent-crimson)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-crimson)' }}>
                  REQUEST DENIED — PROCESS BLOCKED
                </span>
              </div>
              <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}>
                Blocked PID: 4
              </span>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              fontSize: '0.78rem'
            }}>
              <div>
                <span style={{ color: 'var(--text-subtle)', display: 'block' }}>Requested Vector:</span>
                <span className="mono-val" style={{ color: 'var(--accent-crimson)', fontWeight: 700 }}>[3, 3, 0]</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-subtle)', display: 'block' }}>Available Resources:</span>
                <span className="mono-val" style={{ color: 'var(--primary-cyan)', fontWeight: 700 }}>[2, 3, 0] / [3, 3, 2]</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-subtle)', display: 'block' }}>Remaining Need:</span>
                <span className="mono-val" style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>[4, 3, 1]</span>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#fca5a5', lineHeight: 1.4 }}>
              <strong>Engine Rejection Reason:</strong> {req2Event.details.reason}.
              <br />
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Process P4 requested 3 instances of Resource A, but Available is insufficient. P4 transitions to BLOCKED state awaiting release.
              </span>
            </p>
          </div>
        )}

        {activeRequestTab === 'req3' && req3Event && (
          <div
            data-testid="blocked-process-req3"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <XCircle size={20} color="var(--accent-crimson)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-crimson)' }}>
                  REQUEST DENIED — POTENTIAL DEADLOCK / UNSAFE STATE
                </span>
              </div>
              <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}>
                Blocked PID: 0
              </span>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              fontSize: '0.78rem'
            }}>
              <div>
                <span style={{ color: 'var(--text-subtle)', display: 'block' }}>Requested Vector:</span>
                <span className="mono-val" style={{ color: 'var(--accent-crimson)', fontWeight: 700 }}>[0, 2, 0]</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-subtle)', display: 'block' }}>Available Resources:</span>
                <span className="mono-val" style={{ color: 'var(--primary-cyan)', fontWeight: 700 }}>[2, 3, 0]</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-subtle)', display: 'block' }}>Remaining Need:</span>
                <span className="mono-val" style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>[7, 4, 3]</span>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#fca5a5', lineHeight: 1.4 }}>
              <strong>Engine Rejection Reason:</strong> {req3Event.details.reason}.
              <br />
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Even though sufficient resources exist to grant [0, 2, 0], speculative allocation leaves Work = [2, 1, 0], from which NO process can complete its remaining need. The request is denied to prevent unavoidable deadlock.
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankerStepper;
