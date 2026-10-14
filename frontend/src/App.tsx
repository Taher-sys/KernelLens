import React, { useState } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { CpuReplay } from './features/CpuReplay';
import { MemoryVisualizer } from './features/MemoryVisualizer';
import { SyncVisualizer } from './features/SyncVisualizer';
import { DiskVisualizer } from './features/DiskVisualizer';
import { AllocatorVisualizer } from './features/AllocatorVisualizer';
import { FilesystemVisualizer } from './features/FilesystemVisualizer';
import { PolicyComparison } from './features/PolicyComparison';
import { ExportDrawer } from './components/ExportDrawer';
import { runCpuSimulation } from './bridge/simulationBridge';
import { SimulationResponse } from './types/schema';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('cpu');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [lastResponse, setLastResponse] = useState<SimulationResponse | null>(null);

  // Initialize a baseline response for export if not yet run
  React.useEffect(() => {
    const defaultResp = runCpuSimulation(
      [
        { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 24 }], basePriority: 0, niceValue: 0 },
        { pid: 2, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 },
        { pid: 3, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 }
      ],
      'ROUND_ROBIN',
      { quantum: 3 }
    );
    setLastResponse(defaultResp);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExport={() => setIsExportOpen(true)}
      />

      <main style={{ flex: 1, paddingBottom: 60 }}>
        {activeTab === 'cpu' && <CpuReplay />}
        {activeTab === 'memory' && <MemoryVisualizer />}
        {activeTab === 'sync' && <SyncVisualizer />}
        {activeTab === 'disk' && <DiskVisualizer />}
        {activeTab === 'allocator' && <AllocatorVisualizer />}
        {activeTab === 'filesystem' && <FilesystemVisualizer />}
        {activeTab === 'compare' && <PolicyComparison />}
      </main>

      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '16px 24px',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--text-subtle)',
        background: 'rgba(7, 10, 18, 0.95)'
      }}>
        <div style={{ maxWidth: 1600, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>KernelLens © 2026–27 Operating Systems Lab (AID20090) — Course Project</span>
          <span>Deterministic C++17 Discrete-Event Engine & D3.js Visualizations</span>
        </div>
      </footer>

      <ExportDrawer
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        currentResponse={lastResponse}
      />
    </div>
  );
};

export default App;
