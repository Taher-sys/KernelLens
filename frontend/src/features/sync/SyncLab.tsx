import React, { useState } from 'react';
import { ShieldCheck, Network, Terminal } from 'lucide-react';
import { RagGraph } from './RagGraph';
import { BankerStepper } from './BankerStepper';
import { SyncInspector } from './SyncInspector';
import {
  GOLDEN_BANKER_SILBERSCHATZ,
  GOLDEN_RAG_DEADLOCK_EVENTS
} from '../../bridge/syncGoldenData';

export const SyncLab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rag' | 'banker' | 'inspector'>('rag');

  // Combined sync events for the inspector
  const allSyncEvents = React.useMemo(() => {
    return [
      ...GOLDEN_RAG_DEADLOCK_EVENTS,
      ...GOLDEN_BANKER_SILBERSCHATZ.events
    ].sort((a, b) => a.seq - b.seq);
  }, []);

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Route Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-purple" style={{ fontSize: '0.72rem' }}>Phase 4 Module</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>schemaVersion: 1</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginTop: 4 }}>
            Synchronization & Deadlock Lab
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4, maxWidth: 900 }}>
            Interactive exploration of Deadlock Detection with D3 Resource Allocation Graphs (RAG) and Deadlock Avoidance via Banker’s Algorithm Safe-Sequence Stepper. Strictly powered by the deterministic C++17 simulation engine.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 8, background: 'rgba(255, 255, 255, 0.03)', padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setActiveTab('rag')}
            className={`btn-secondary ${activeTab === 'rag' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.8rem' }}
          >
            <Network size={14} color="var(--primary-cyan)" />
            <span>Resource Allocation Graph</span>
          </button>
          <button
            onClick={() => setActiveTab('banker')}
            className={`btn-secondary ${activeTab === 'banker' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.8rem' }}
          >
            <ShieldCheck size={14} color="var(--accent-purple)" />
            <span>Banker’s Safe-Sequence Stepper</span>
          </button>
          <button
            onClick={() => setActiveTab('inspector')}
            className={`btn-secondary ${activeTab === 'inspector' ? 'btn-active' : ''}`}
            style={{ fontSize: '0.8rem' }}
          >
            <Terminal size={14} color="var(--accent-emerald)" />
            <span>Sync Event Inspector</span>
          </button>
        </div>
      </div>

      {/* Main Feature View */}
      {activeTab === 'rag' && <RagGraph />}
      {activeTab === 'banker' && <BankerStepper />}
      {activeTab === 'inspector' && <SyncInspector events={allSyncEvents} />}
    </div>
  );
};

export default SyncLab;
