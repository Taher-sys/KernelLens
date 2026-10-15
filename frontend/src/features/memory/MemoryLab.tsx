import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  AlertTriangle,
  Zap,
  Activity
} from 'lucide-react';
import { defaultEngineBridge } from '../../bridge/engineBridge';
import {
  MemoryPolicy,
  SimulationRequest,
  SimulationResponse,
  MemoryMetrics
} from '../../bridge/schema';
import {
  replayMemoryFramesAtTick,
  replayTlbAtTick
} from '../../bridge/memoryGoldenData';
import { FrameGrid } from './FrameGrid';
import { FaultTimeline } from './FaultTimeline';
import { TlbPanel } from './TlbPanel';
import { AllocationBlocks } from './AllocationBlocks';

const BELADY_STRING = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
const TEXTBOOK_STRING = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
const UNCONNECTED_CUSTOM_STRING = [9, 9, 8, 8, 7, 7]; // Not in golden cache, will demonstrate engine not connected

export const MemoryLab: React.FC = () => {
  // Configuration State
  const [policy, setPolicy] = useState<MemoryPolicy>('FIFO');
  const [numFrames, setNumFrames] = useState<number>(3);
  const [preset, setPreset] = useState<'belady' | 'textbook' | 'custom'>('belady');
  const [referenceString, setReferenceString] = useState<number[]>(BELADY_STRING);

  // Simulation execution state
  const [simResponse, setSimResponse] = useState<SimulationResponse | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [engineNotConnected, setEngineNotConnected] = useState<boolean>(false);

  // Playback / Timeline state
  const [currentTick, setCurrentTick] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [memorySubTab, setMemorySubTab] = useState<'paging' | 'contiguous'>('paging');

  // Dispatch simulation request to bridge contract
  // NEVER simulate page replacement in TypeScript
  const executeMemorySimulation = async (
    targetRefs: number[],
    targetPolicy: MemoryPolicy,
    targetFrames: number
  ) => {
    setIsExecuting(true);
    setEngineNotConnected(false);

    try {
      const request: SimulationRequest = {
        schemaVersion: 1,
        runId: `mem-${targetPolicy.toLowerCase()}-${targetFrames}f`,
        seed: 42,
        module: 'memory',
        policy: {
          name: targetPolicy
        },
        workload: {
          references: targetRefs
        },
        options: {
          numFrames: targetFrames,
          tlbCapacity: 4
        }
      };

      const response = await defaultEngineBridge.run(request);

      if (response.status === 'not_connected') {
        setEngineNotConnected(true);
        setSimResponse(null);
      } else {
        setSimResponse(response);
        setEngineNotConnected(false);
      }
      setCurrentTick(0);
      setIsPlaying(false);
    } catch {
      setEngineNotConnected(true);
      setSimResponse(null);
    } finally {
      setIsExecuting(false);
    }
  };

  // Initial execution on mount
  useEffect(() => {
    executeMemorySimulation(referenceString, policy, numFrames);
  }, []);

  const totalTicks = referenceString.length;

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying || !simResponse || totalTicks === 0) return;
    const intervalTime = Math.max(50, Math.floor(600 / playbackSpeed));
    const timer = setInterval(() => {
      setCurrentTick(t => {
        if (t >= totalTicks - 1) {
          setIsPlaying(false);
          return totalTicks - 1;
        }
        return t + 1;
      });
    }, intervalTime);
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, totalTicks, simResponse]);

  // Pure event replay reconstruction at currentTick (zero algorithm simulation)
  const tickState = useMemo(() => {
    if (!simResponse || simResponse.events.length === 0) {
      return {
        frames: Array.from({ length: numFrames }, (_, i) => ({
          frameId: i,
          page: null,
          loadedAt: 0,
          lastUsedAt: 0,
          referenceBit: false,
          isVictim: false,
          isHit: false
        })),
        lastEvicted: null,
        isFault: false,
        tlbEntries: [],
        lastTlbHit: null
      };
    }

    const frameReplay = replayMemoryFramesAtTick(simResponse.events, numFrames, currentTick);
    const tlbReplay = replayTlbAtTick(simResponse.events, 4, currentTick);

    return {
      frames: frameReplay.frames,
      lastEvicted: frameReplay.lastEvicted,
      isFault: frameReplay.isFault,
      tlbEntries: tlbReplay.entries,
      lastTlbHit: tlbReplay.lastHit
    };
  }, [simResponse, numFrames, currentTick]);

  // Find target page at currentTick
  const currentPage = referenceString[currentTick] ?? null;
  const currentTickEvents = useMemo(() => {
    if (!simResponse) return [];
    return simResponse.events.filter(e => e.time === currentTick);
  }, [simResponse, currentTick]);

  const targetFrameIndex = useMemo(() => {
    const loadedEvt = currentTickEvents.find(e => e.type === 'frame_loaded' || e.type === 'page_access');
    if (loadedEvt?.details?.frame !== undefined) {
      return loadedEvt.details.frame;
    }
    const faultEvt = currentTickEvents.find(e => e.type === 'page_fault');
    if (faultEvt?.details?.frame !== undefined) {
      return faultEvt.details.frame;
    }
    return null;
  }, [currentTickEvents]);

  const memoryMetrics: MemoryMetrics = simResponse?.memoryMetrics ?? {
    totalAccesses: 0,
    pageFaults: 0,
    tlbHits: 0,
    tlbMisses: 0,
    faultRate: 0,
    tlbHitRate: 0
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 24px', maxWidth: 1600, margin: '0 auto', width: '100%' }}>
      {/* Route Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={24} color="var(--primary-cyan)" />
            <span>Virtual Memory & Page Replacement Lab</span>
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-subtle)', marginTop: 4 }}>
            Deterministic C++17 discrete-event paging simulation (<code style={{ color: 'var(--primary-cyan)' }}>schemaVersion: 1</code>). Algorithms are never simulated in TypeScript.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: engineNotConnected ? '#ef4444' : simResponse ? 'var(--accent-emerald)' : 'var(--text-subtle)' }} />
            <span>{isExecuting ? 'Querying Engine...' : engineNotConnected ? 'Engine Not Connected' : 'Engine Ready'}</span>
          </div>
          <span className="badge badge-cyan">{numFrames} Frames</span>
          <span className="badge badge-emerald">TLB Cap: 4</span>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => setMemorySubTab('paging')}
          className={`btn-secondary ${memorySubTab === 'paging' ? 'btn-active' : ''}`}
        >
          Virtual Memory & Page Frames (D3)
        </button>
        <button
          onClick={() => setMemorySubTab('contiguous')}
          className={`btn-secondary ${memorySubTab === 'contiguous' ? 'btn-active' : ''}`}
        >
          Contiguous Memory & Fit Allocator
        </button>
      </div>

      {memorySubTab === 'contiguous' ? (
        <AllocationBlocks />
      ) : (
        <>
          {/* Explicit "Engine Not Connected" State Banner */}
          {engineNotConnected && (
        <div
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid #ef4444',
            borderRadius: 'var(--radius-md)',
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)'
          }}
        >
          <AlertTriangle size={24} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fca5a5' }}>
              engine not connected
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
              The requested simulation requires the native C++17 discrete-event simulation engine.
              Per KernelLens Operating Principles, page replacement algorithms are <strong>never simulated in TypeScript</strong>.
              Connect the engine or select one of the verified C++ golden benchmarks below.
            </p>
            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setPreset('belady');
                  setReferenceString(BELADY_STRING);
                  setPolicy('FIFO');
                  setNumFrames(3);
                  executeMemorySimulation(BELADY_STRING, 'FIFO', 3);
                }}
                className="btn-primary"
                style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              >
                Load Verified C++ Belady Benchmark
              </button>
              <button
                onClick={() => {
                  setPreset('textbook');
                  setReferenceString(TEXTBOOK_STRING);
                  setPolicy('LRU');
                  setNumFrames(3);
                  executeMemorySimulation(TEXTBOOK_STRING, 'LRU', 3);
                }}
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              >
                Load Verified C++ Textbook Benchmark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Configuration & Presets Bar */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Row 1: Presets */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, minWidth: 80 }}>Workload:</span>
          <button
            onClick={() => {
              setPreset('belady');
              setReferenceString(BELADY_STRING);
              executeMemorySimulation(BELADY_STRING, policy, numFrames);
            }}
            className={`btn-secondary ${preset === 'belady' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            Belady Anomaly String (12 Refs)
          </button>
          <button
            onClick={() => {
              setPreset('textbook');
              setReferenceString(TEXTBOOK_STRING);
              executeMemorySimulation(TEXTBOOK_STRING, policy, numFrames);
            }}
            className={`btn-secondary ${preset === 'textbook' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            Silberschatz Textbook (20 Refs)
          </button>
          <button
            onClick={() => {
              setPreset('custom');
              setReferenceString(UNCONNECTED_CUSTOM_STRING);
              executeMemorySimulation(UNCONNECTED_CUSTOM_STRING, policy, numFrames);
            }}
            className={`btn-secondary ${preset === 'custom' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            Custom String (Engine Not Connected Demo)
          </button>
        </div>

        {/* Row 2: Policy & Frames */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
          {/* Policy Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, minWidth: 80 }}>Policy:</span>
            {(['FIFO', 'LRU', 'OPTIMAL', 'CLOCK'] as MemoryPolicy[]).map(pol => (
              <button
                key={pol}
                onClick={() => {
                  setPolicy(pol);
                  executeMemorySimulation(referenceString, pol, numFrames);
                }}
                className={`btn-secondary ${policy === pol ? 'btn-active' : ''}`}
                style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              >
                {pol}
              </button>
            ))}
          </div>

          {/* Frames Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Frames:</span>
            {[3, 4, 5].map(f => (
              <button
                key={f}
                onClick={() => {
                  setNumFrames(f);
                  executeMemorySimulation(referenceString, policy, f);
                }}
                className={`btn-secondary ${numFrames === f ? 'btn-active' : ''}`}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                {f} Frames
              </button>
            ))}

            <button
              onClick={() => executeMemorySimulation(referenceString, policy, numFrames)}
              disabled={isExecuting}
              className="btn-primary"
              style={{ fontSize: '0.78rem', padding: '6px 14px', marginLeft: 8 }}
            >
              <Activity size={14} style={{ marginRight: 6 }} />
              <span>{isExecuting ? 'Running...' : 'Run Engine'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Belady Anomaly Demonstration Banner */}
      {preset === 'belady' && policy === 'FIFO' && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.82rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={18} color="var(--accent-amber)" />
            <span>
              <strong>Belady's Anomaly Benchmark (C++ Engine Verified):</strong> FIFO on [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5] yields <strong>9 faults</strong> on 3 frames, but <strong>10 faults</strong> on 4 frames!
            </span>
          </div>
          <span className="badge badge-amber">3 Frames: 9 faults | 4 Frames: 10 faults</span>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Left Column: D3 FaultTimeline & Physical Frames Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Fault Timeline Component */}
          <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Page Fault & Reference Timeline</span>
                <span className="badge badge-cyan">{policy}</span>
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono-val" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary-cyan)' }}>
                  {currentTick + 1} / {totalTicks}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>accesses</span>
              </div>
            </div>

            {/* D3 Fault Timeline Component */}
            <FaultTimeline
              events={simResponse?.events ?? []}
              currentTick={currentTick}
              totalTicks={totalTicks}
              referenceString={referenceString}
              onSeek={t => { setCurrentTick(t); setIsPlaying(false); }}
              emptyMessage={engineNotConnected ? 'engine not connected: no timeline data' : 'No memory events recorded'}
            />

            {/* Playback & Scrubber Controls */}
            {simResponse && simResponse.events.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="btn-primary"
                  style={{ width: 95, justifyContent: 'center' }}
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
                  title="Step Back 1 Access"
                >
                  <SkipBack size={15} />
                </button>

                <button
                  onClick={() => setCurrentTick(t => Math.min(totalTicks - 1, t + 1))}
                  className="btn-secondary"
                  title="Step Forward 1 Access"
                >
                  <SkipForward size={15} />
                </button>

                {/* Scrubber slider */}
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, totalTicks - 1)}
                  value={currentTick}
                  onChange={e => {
                    setCurrentTick(Number(e.target.value));
                    setIsPlaying(false);
                  }}
                  style={{ flex: 1, minWidth: 140, accentColor: 'var(--primary-cyan)', cursor: 'pointer' }}
                />

                {/* Speed Multiplier */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {[0.5, 1, 2].map(spd => (
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
            )}
          </div>

          {/* Physical Frame Grid Component */}
          <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                  Physical Frame Allocation & State
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 2 }}>
                  Inspecting physical memory frames at <span style={{ color: 'var(--primary-cyan)', fontWeight: 600 }}>access #{currentTick}</span> (Referenced Page: P{currentPage})
                </p>
              </div>
            </div>

            <FrameGrid
              frames={tickState.frames}
              currentTick={currentTick}
              isPageFault={tickState.isFault}
              evictedPage={tickState.lastEvicted}
              targetPage={currentPage}
              targetFrame={targetFrameIndex}
              emptyMessage={engineNotConnected ? 'engine not connected: no frame data' : 'No frames loaded'}
            />
          </div>
        </div>

        {/* Right Column: TLB Panel & Memory Quantitative Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* TLB Panel Component */}
          <TlbPanel
            entries={tickState.tlbEntries}
            capacity={4}
            lastHit={tickState.lastTlbHit}
            activePage={currentPage}
            metrics={memoryMetrics}
            emptyMessage={engineNotConnected ? 'engine not connected: TLB unavailable' : 'TLB is empty'}
          />

          {/* Quantitative Memory Metrics Card */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} color="var(--primary-cyan)" />
              Paging Metrics
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Total Accesses</span>
                <p className="mono-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                  {memoryMetrics.totalAccesses}
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Page Faults</span>
                <p className="mono-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444', marginTop: 4 }}>
                  {memoryMetrics.pageFaults}
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Fault Rate</span>
                <p className="mono-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: 4 }}>
                  {(memoryMetrics.faultRate * 100).toFixed(1)}%
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>TLB Hit Rate</span>
                <p className="mono-val" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-cyan)', marginTop: 4 }}>
                  {(memoryMetrics.tlbHitRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
