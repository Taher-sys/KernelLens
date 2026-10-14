import React, { useState } from 'react';
import { X, Download, Copy, Check, FileJson, FileSpreadsheet } from 'lucide-react';
import { SimulationResponse } from '../types/schema';

interface ExportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentResponse?: SimulationResponse | null;
}

export const ExportDrawer: React.FC<ExportDrawerProps> = ({ isOpen, onClose, currentResponse }) => {
  const [activeFormat, setActiveFormat] = useState<'json-events' | 'csv-metrics' | 'json-full'>('json-full');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate contents
  const jsonFullContent = currentResponse ? JSON.stringify(currentResponse, null, 2) : 'No simulation run loaded yet.';
  
  const jsonEventsContent = currentResponse?.events
    ? JSON.stringify(currentResponse.events, null, 2)
    : '[]';

  const generateCsv = () => {
    if (!currentResponse || !currentResponse.metrics?.perProcess) return 'pid,waiting_time,turnaround_time,response_time,cpu_service\n';
    const rows = [
      'pid,waiting_time,turnaround_time,response_time,cpu_service',
      ...currentResponse.metrics.perProcess.map(
        p => `${p.pid},${p.waitingTime},${p.turnaroundTime},${p.responseTime},${p.cpuService}`
      )
    ];
    return rows.join('\n');
  };

  const csvContent = generateCsv();

  const currentText =
    activeFormat === 'json-full'
      ? jsonFullContent
      : activeFormat === 'json-events'
      ? jsonEventsContent
      : csvContent;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = activeFormat === 'csv-metrics' ? 'csv' : 'json';
    const mime = activeFormat === 'csv-metrics' ? 'text/csv' : 'application/json';
    const blob = new Blob([currentText], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kernellens-${activeFormat}-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: 24
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: 780,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-glow)',
        border: '1px solid var(--border-glow)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, var(--primary-cyan), var(--primary-blue))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Download size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Export Simulation Results</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                Deterministic event logs and metrics conforming to KernelLens v1 Schema
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Format Selectors */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => setActiveFormat('json-full')}
            className={activeFormat === 'json-full' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <FileJson size={14} />
            <span>Full Artifact (JSON)</span>
          </button>
          <button
            onClick={() => setActiveFormat('json-events')}
            className={activeFormat === 'json-events' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <FileJson size={14} />
            <span>Event Stream Log (JSON)</span>
          </button>
          <button
            onClick={() => setActiveFormat('csv-metrics')}
            className={activeFormat === 'csv-metrics' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <FileSpreadsheet size={14} />
            <span>Process Metrics (CSV)</span>
          </button>
        </div>

        {/* Preview Code Block */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
          border: '1px solid var(--border-subtle)',
          fontFamily: 'monospace',
          fontSize: '0.78rem',
          color: '#38ef7d',
          maxHeight: 400
        }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {currentText}
          </pre>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button
            onClick={handleCopy}
            className="btn-secondary"
            style={{ fontSize: '0.825rem', padding: '8px 16px' }}
          >
            {copied ? <Check size={16} color="var(--accent-green)" /> : <Copy size={16} />}
            <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="btn-primary"
            style={{ fontSize: '0.825rem', padding: '8px 16px' }}
          >
            <Download size={16} />
            <span>Download File</span>
          </button>
        </div>
      </div>
    </div>
  );
};
