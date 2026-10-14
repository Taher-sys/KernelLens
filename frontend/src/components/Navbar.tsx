import React from 'react';
import { Cpu, HardDrive, ShieldAlert, Layers, Database, FolderTree, GitCompare, Download } from 'lucide-react';

export type ActiveTab = 'cpu' | 'memory' | 'sync' | 'disk' | 'allocator' | 'filesystem' | 'compare';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onExport: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onExport }) => {
  const navItems = [
    { id: 'cpu', label: 'CPU Schedulers', icon: Cpu },
    { id: 'memory', label: 'Virtual Memory & Paging', icon: Layers },
    { id: 'sync', label: 'Deadlocks & Banker', icon: ShieldAlert },
    { id: 'disk', label: 'Disk Head Route', icon: HardDrive },
    { id: 'allocator', label: 'Allocators (Tier 2)', icon: Database },
    { id: 'filesystem', label: 'Inode & WAL (Tier 2)', icon: FolderTree },
    { id: 'compare', label: 'Policy Matrix', icon: GitCompare }
  ];

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(7, 10, 18, 0.85)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0 24px'
    }}>
      <div style={{
        maxWidth: 1600,
        margin: '0 auto',
        height: 68,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--primary-cyan) 0%, var(--primary-blue) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            boxShadow: 'var(--shadow-glow)'
          }}>
            🔬
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #fff 40%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                KernelLens
              </span>
              <span className="badge badge-cyan" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>C++17 Engine</span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
              Deterministic Discrete-Event OS Simulation Lab
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '4px 0' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'rgba(79, 172, 254, 0.15)' : 'transparent',
                  border: isActive ? '1px solid var(--border-glow)' : '1px solid transparent',
                  color: isActive ? 'var(--primary-cyan)' : 'var(--text-muted)',
                  fontSize: '0.825rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Global Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onExport}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            title="Export JSON Event Log & CSV Metrics"
          >
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
