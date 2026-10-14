import React, { useState } from 'react';
import { Database, Plus, Trash2, AlertCircle } from 'lucide-react';

interface Block {
  id: number;
  start: number;
  size: number;
  allocated: boolean;
  owner?: number;
}

export const AllocatorVisualizer: React.FC = () => {
  const totalCapacity = 1000;
  const [policy, setPolicy] = useState<'FIRST_FIT' | 'BEST_FIT' | 'WORST_FIT'>('FIRST_FIT');
  const [blocks, setBlocks] = useState<Block[]>([
    { id: 1, start: 0, size: 200, allocated: true, owner: 1 },
    { id: 2, start: 200, size: 150, allocated: false },
    { id: 3, start: 350, size: 300, allocated: true, owner: 2 },
    { id: 4, start: 650, size: 200, allocated: false },
    { id: 5, start: 850, size: 150, allocated: false }
  ]);

  const [allocPid, setAllocPid] = useState(3);
  const [allocSize, setAllocSize] = useState(250);
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const totalFree = blocks.filter(b => !b.allocated).reduce((acc, b) => acc + b.size, 0);

  function handleAllocate() {
    let candidateIdx = -1;

    if (policy === 'FIRST_FIT') {
      candidateIdx = blocks.findIndex(b => !b.allocated && b.size >= allocSize);
    } else if (policy === 'BEST_FIT') {
      let minSlack = Infinity;
      blocks.forEach((b, idx) => {
        if (!b.allocated && b.size >= allocSize) {
          const slack = b.size - allocSize;
          if (slack < minSlack) {
            minSlack = slack;
            candidateIdx = idx;
          }
        }
      });
    } else if (policy === 'WORST_FIT') {
      let maxSlack = -1;
      blocks.forEach((b, idx) => {
        if (!b.allocated && b.size >= allocSize) {
          const slack = b.size - allocSize;
          if (slack > maxSlack) {
            maxSlack = slack;
            candidateIdx = idx;
          }
        }
      });
    }

    if (candidateIdx === -1) {
      if (totalFree >= allocSize) {
        setMsg({
          text: `Allocation failed: External fragmentation! Total free memory is ${totalFree} KB, but no single contiguous hole is >= ${allocSize} KB.`,
          isError: true
        });
      } else {
        setMsg({ text: `Allocation failed: Out of memory (requested ${allocSize} KB, free ${totalFree} KB).`, isError: true });
      }
      return;
    }

    const target = blocks[candidateIdx];
    const newBlocks = [...blocks];

    if (target.size === allocSize) {
      newBlocks[candidateIdx] = { ...target, allocated: true, owner: allocPid };
    } else {
      const allocatedBlock: Block = {
        id: Date.now(),
        start: target.start,
        size: allocSize,
        allocated: true,
        owner: allocPid
      };
      const remainderBlock: Block = {
        id: Date.now() + 1,
        start: target.start + allocSize,
        size: target.size - allocSize,
        allocated: false
      };
      newBlocks.splice(candidateIdx, 1, allocatedBlock, remainderBlock);
    }

    setBlocks(newBlocks);
    setMsg({ text: `Successfully allocated ${allocSize} KB to Process P${allocPid} using ${policy}.`, isError: false });
    setAllocPid(p => p + 1);
  }

  function handleDeallocate(owner: number) {
    const updated = blocks.map(b => b.owner === owner ? { ...b, allocated: false, owner: undefined } : b);
    // Coalesce adjacent free holes
    const coalesced: Block[] = [updated[0]];
    for (let i = 1; i < updated.length; ++i) {
      const prev = coalesced[coalesced.length - 1];
      const curr = updated[i];
      if (!prev.allocated && !curr.allocated) {
        prev.size += curr.size;
      } else {
        coalesced.push(curr);
      }
    }
    setBlocks(coalesced);
    setMsg({ text: `Deallocated Process P${owner} and coalesced adjacent free holes.`, isError: false });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Controls */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Policy:</span>
          {(['FIRST_FIT', 'BEST_FIT', 'WORST_FIT'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPolicy(p)}
              className={`btn-secondary ${policy === p ? 'btn-active' : ''}`}
              style={{ fontSize: '0.78rem', padding: '5px 12px' }}
            >
              {p.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Free:</span>
          <span className="mono-val" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-cyan)' }}>
            {totalFree} / {totalCapacity} KB
          </span>
        </div>
      </div>

      {msg && (
        <div style={{
          background: msg.isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
          border: msg.isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <AlertCircle size={18} color={msg.isError ? 'var(--accent-crimson)' : 'var(--accent-emerald)'} />
          <span style={{ fontSize: '0.82rem', color: msg.isError ? '#fca5a5' : '#86efac' }}>{msg.text}</span>
        </div>
      )}

      {/* Main Grid: Visual Map & Action Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} color="var(--primary-cyan)" />
            Contiguous Memory Address Layout (0 KB to 1000 KB)
          </h3>

          {/* Visual Bar Map */}
          <div style={{ width: '100%', height: 60, display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            {blocks.map(b => (
              <div
                key={b.id}
                style={{
                  width: `${(b.size / totalCapacity) * 100}%`,
                  height: '100%',
                  background: b.allocated ? 'linear-gradient(135deg, rgba(79, 172, 254, 0.6) 0%, rgba(0, 242, 254, 0.6) 100%)' : 'rgba(255, 255, 255, 0.05)',
                  borderRight: '1px solid rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  color: '#fff',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  overflow: 'hidden'
                }}
                title={b.allocated ? `Process P${b.owner} (${b.size} KB)` : `Free Hole (${b.size} KB)`}
              >
                <span>{b.allocated ? `P${b.owner}` : 'Free'}</span>
                <span className="mono-val" style={{ fontSize: '0.65rem', opacity: 0.8 }}>{b.size}K</span>
              </div>
            ))}
          </div>

          {/* Block Details List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {blocks.map(b => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`badge ${b.allocated ? 'badge-cyan' : 'badge-emerald'}`}>
                    {b.allocated ? `Allocated (P${b.owner})` : 'Free Hole'}
                  </span>
                  <span className="mono-val" style={{ fontSize: '0.8rem' }}>
                    [{b.start} KB - {b.start + b.size} KB] ({b.size} KB)
                  </span>
                </div>
                {b.allocated && (
                  <button
                    onClick={() => handleDeallocate(b.owner!)}
                    className="btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '4px 8px', color: 'var(--accent-crimson)' }}
                  >
                    <Trash2 size={12} />
                    <span>Free</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Drawer: Allocation Sandbox */}
        <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Allocate Block</h3>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Process ID:</label>
            <input
              type="number"
              value={allocPid}
              onChange={e => setAllocPid(Number(e.target.value))}
              style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Requested Bytes (KB):</label>
            <input
              type="number"
              step={10}
              value={allocSize}
              onChange={e => setAllocSize(Number(e.target.value))}
              style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff' }}
            />
          </div>

          <button onClick={handleAllocate} className="btn-primary" style={{ justifyContent: 'center', marginTop: 10 }}>
            <Plus size={16} />
            <span>Request Allocation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
