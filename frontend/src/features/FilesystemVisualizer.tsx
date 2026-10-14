import React, { useState } from 'react';
import { FolderTree, FileText, Folder, AlertTriangle, ShieldCheck } from 'lucide-react';

interface FileNode {
  name: string;
  isDir: boolean;
  inode: number;
  size: number;
  perms: string;
  blocks: number[];
  children?: FileNode[];
  content?: string;
}

export const FilesystemVisualizer: React.FC = () => {
  const [tree, setTree] = useState<FileNode>({
    name: '/',
    isDir: true,
    inode: 1,
    size: 4096,
    perms: '0755',
    blocks: [1, 2],
    children: [
      {
        name: 'home',
        isDir: true,
        inode: 2,
        size: 4096,
        perms: '0755',
        blocks: [3],
        children: [
          {
            name: 'student.txt',
            isDir: false,
            inode: 4,
            size: 24,
            perms: '0644',
            blocks: [5],
            content: 'Operating Systems Lab 2026'
          }
        ]
      },
      {
        name: 'docs',
        isDir: true,
        inode: 3,
        size: 4096,
        perms: '0755',
        blocks: [4],
        children: [
          {
            name: 'architecture.md',
            isDir: false,
            inode: 5,
            size: 512,
            perms: '0644',
            blocks: [6, 7],
            content: '# KernelLens Architecture Spec'
          }
        ]
      }
    ]
  });

  const [selectedNode, setSelectedNode] = useState<FileNode>(tree.children![0].children![0]);

  // WAL Journal & Crash Simulation State
  const [journalLog, setJournalLog] = useState<Array<{ id: number; op: string; path: string; status: 'ACTIVE' | 'COMMITTED' | 'DISCARDED' }>>([
    { id: 101, op: 'CREATE_FILE', path: '/home/student.txt', status: 'COMMITTED' },
    { id: 102, op: 'CREATE_FILE', path: '/docs/architecture.md', status: 'COMMITTED' }
  ]);
  const [crashStatus, setCrashStatus] = useState<string | null>(null);

  function handleCrashDemo(point: 'PRE_COMMIT' | 'POST_COMMIT') {
    const txId = Date.now();
    const newTx = {
      id: txId,
      op: 'CREATE_FILE',
      path: '/home/crash_test.txt',
      status: point === 'PRE_COMMIT' ? ('ACTIVE' as const) : ('COMMITTED' as const)
    };

    setJournalLog(prev => [...prev, newTx]);

    if (point === 'PRE_COMMIT') {
      setCrashStatus(`⚡ CRASH INJECTED (Pre-Commit)! Transaction ${txId} had unwritten commit record. On recovery: Transaction was safely rolled back / discarded without corrupting filesystem.`);
    } else {
      setCrashStatus(`⚡ CRASH INJECTED (Post-Commit)! Transaction ${txId} was committed to WAL log before crash. On recovery: Journal REDO applied changes to disk.`);
      // Add node to tree
      const updatedTree = { ...tree };
      updatedTree.children![0].children!.push({
        name: 'crash_test.txt',
        isDir: false,
        inode: 99,
        size: 64,
        perms: '0644',
        blocks: [10],
        content: 'Data recovered from WAL transaction log'
      });
      setTree(updatedTree);
    }
  }

  function renderTree(node: FileNode, depth = 0) {
    return (
      <div key={node.inode} style={{ paddingLeft: depth * 18 }}>
        <div
          onClick={() => setSelectedNode(node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: selectedNode.inode === node.inode ? 'rgba(79, 172, 254, 0.15)' : 'transparent',
            color: selectedNode.inode === node.inode ? 'var(--primary-cyan)' : 'var(--text-main)',
            fontSize: '0.8rem',
            fontWeight: node.isDir ? 700 : 500
          }}
        >
          {node.isDir ? <Folder size={15} color="var(--primary-cyan)" /> : <FileText size={15} color="var(--text-subtle)" />}
          <span>{node.name}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', marginLeft: 'auto' }}>#{node.inode}</span>
        </div>
        {node.children && node.children.map(child => renderTree(child, depth + 1))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderTree size={18} color="var(--primary-cyan)" />
            In-Memory Inode Filesystem & Write-Ahead Logging (WAL)
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 2 }}>
            Tier 2 educational teaching model demonstrating directory hierarchy, inode metadata, and crash-recovery state machines.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => handleCrashDemo('PRE_COMMIT')}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', color: '#fca5a5' }}
          >
            <AlertTriangle size={14} />
            <span>Simulate Pre-Commit Crash</span>
          </button>
          <button
            onClick={() => handleCrashDemo('POST_COMMIT')}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', color: '#86efac' }}
          >
            <ShieldCheck size={14} />
            <span>Simulate Post-Commit Recovery</span>
          </button>
        </div>
      </div>

      {crashStatus && (
        <div style={{
          background: 'rgba(79, 172, 254, 0.1)',
          border: '1px solid var(--border-glow)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 18px',
          fontSize: '0.8rem',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <span>{crashStatus}</span>
        </div>
      )}

      {/* Main Grid: Tree Explorer & Inode Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: 24 }}>
        {/* Directory Tree */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-muted)' }}>
            Directory Tree
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderTree(tree)}
          </div>
        </div>

        {/* Selected Inode Details */}
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedNode.isDir ? <Folder size={18} color="var(--primary-cyan)" /> : <FileText size={18} color="var(--primary-cyan)" />}
              <span>{selectedNode.name}</span>
            </h3>
            <span className="badge badge-cyan">Inode #{selectedNode.inode}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Permissions</span>
              <p className="mono-val" style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 2 }}>{selectedNode.perms}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Size</span>
              <p className="mono-val" style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 2 }}>{selectedNode.size} Bytes</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-sm)', gridColumn: 'span 2' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Allocated Direct Blocks</span>
              <p className="mono-val" style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)', marginTop: 2 }}>
                [{selectedNode.blocks.join(', ')}]
              </p>
            </div>
          </div>

          {selectedNode.content && (
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>File Content:</span>
              <pre style={{
                background: 'rgba(5, 8, 14, 0.7)',
                padding: 14,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: '#fff',
                whiteSpace: 'pre-wrap'
              }}>
                {selectedNode.content}
              </pre>
            </div>
          )}
        </div>

        {/* WAL Journal Log */}
        <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            WAL Journal Log
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
            {journalLog.map(tx => (
              <div
                key={tx.id}
                style={{
                  padding: 10,
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.72rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="mono-val" style={{ fontWeight: 700, color: 'var(--primary-cyan)' }}>TX #{tx.id}</span>
                  <span className={`badge ${tx.status === 'COMMITTED' ? 'badge-emerald' : tx.status === 'ACTIVE' ? 'badge-amber' : 'badge-crimson'}`}>
                    {tx.status}
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  <span>{tx.op}</span> <span className="mono-val" style={{ color: '#fff' }}>{tx.path}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
