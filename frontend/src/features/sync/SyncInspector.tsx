import React, { useState } from 'react';
import { Search, Filter, Terminal, Code } from 'lucide-react';
import { SimEvent } from '../../bridge/schema';

interface SyncInspectorProps {
  events: SimEvent[];
}

export const SyncInspector: React.FC<SyncInspectorProps> = ({ events }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedEventSeq, setSelectedEventSeq] = useState<number | null>(
    events.length > 0 ? events[0].seq : null
  );

  const eventTypes = React.useMemo(() => {
    const types = new Set<string>();
    events.forEach(e => types.add(e.type));
    return ['ALL', ...Array.from(types)];
  }, [events]);

  const filteredEvents = React.useMemo(() => {
    return events.filter(e => {
      const matchesType = selectedType === 'ALL' || e.type === selectedType;
      const matchesSearch =
        searchTerm === '' ||
        e.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(e.details).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.pid !== null && `p${e.pid}`.includes(searchTerm.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [events, selectedType, searchTerm]);

  const selectedEvent = events.find(e => e.seq === selectedEventSeq) || null;

  return (
    <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header and Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={18} color="var(--primary-cyan)" />
            Synchronization & Deadlock Event Inspector
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: 2 }}>
            Verifiable discrete-event log conforming to schemaVersion: 1 emitted by the C++ engine.
          </p>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} color="var(--text-subtle)" style={{ position: 'absolute', left: 10 }} />
            <input
              type="text"
              placeholder="Search event details..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                padding: '6px 10px 6px 32px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                fontSize: '0.78rem',
                minWidth: 180
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} color="var(--text-subtle)" />
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              style={{
                padding: '6px 10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                fontSize: '0.78rem'
              }}
            >
              {eventTypes.map(t => (
                <option key={t} value={t} style={{ background: '#0b101e' }}>
                  {t === 'ALL' ? 'All Event Types' : t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Event Table + JSON Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
        {/* Event Table */}
        <div style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          maxHeight: 460,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0e1424', borderBottom: '1px solid var(--border-subtle)', zIndex: 1 }}>
                <tr style={{ color: 'var(--text-subtle)' }}>
                  <th style={{ padding: '8px 12px', width: 60 }}>Seq</th>
                  <th style={{ padding: '8px 12px', width: 70 }}>Tick</th>
                  <th style={{ padding: '8px 12px', width: 80 }}>PID</th>
                  <th style={{ padding: '8px 12px' }}>Event Type</th>
                  <th style={{ padding: '8px 12px' }}>Details Preview</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-subtle)' }}>
                      No synchronization events match the filter.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map(e => {
                    const isSelected = selectedEventSeq === e.seq;
                    const isDeadlock = e.type === 'deadlock_detected' && e.details.hasDeadlock;
                    const isDenied = e.type === 'banker_request_denied';
                    const isGranted = e.type === 'banker_request_granted';

                    return (
                      <tr
                        key={e.seq}
                        onClick={() => setSelectedEventSeq(e.seq)}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          cursor: 'pointer',
                          background: isSelected
                            ? 'rgba(0, 242, 254, 0.12)'
                            : isDeadlock || isDenied
                            ? 'rgba(239, 68, 68, 0.05)'
                            : 'transparent'
                        }}
                      >
                        <td className="mono-val" style={{ padding: '8px 12px', color: 'var(--text-subtle)' }}>#{e.seq}</td>
                        <td className="mono-val" style={{ padding: '8px 12px' }}>{e.time}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: e.pid !== null ? 'var(--primary-cyan)' : 'var(--text-subtle)' }}>
                          {e.pid !== null ? `P${e.pid}` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.7rem',
                              background: isDeadlock || isDenied
                                ? 'rgba(239, 68, 68, 0.2)'
                                : isGranted
                                ? 'rgba(16, 185, 129, 0.2)'
                                : 'rgba(0, 242, 254, 0.1)',
                              color: isDeadlock || isDenied
                                ? 'var(--accent-crimson)'
                                : isGranted
                                ? 'var(--accent-emerald)'
                                : 'var(--primary-cyan)'
                            }}
                          >
                            {e.type}
                          </span>
                        </td>
                        <td className="mono-val" style={{ padding: '8px 12px', color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {JSON.stringify(e.details)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Event Details Panel */}
        <div style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
          background: 'rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Code size={15} color="var(--primary-cyan)" />
            Event Payload Inspector
          </h4>

          {selectedEvent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.75rem' }}>
                <div>
                  <span style={{ color: 'var(--text-subtle)' }}>Sequence:</span>
                  <strong style={{ marginLeft: 6, color: '#fff' }}>#{selectedEvent.seq}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-subtle)' }}>Sim Tick:</span>
                  <strong style={{ marginLeft: 6, color: 'var(--primary-cyan)' }}>{selectedEvent.time}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-subtle)' }}>Subsystem:</span>
                  <span className="badge badge-purple" style={{ marginLeft: 6, fontSize: '0.68rem' }}>{selectedEvent.subsystem}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-subtle)' }}>PID:</span>
                  <strong style={{ marginLeft: 6, color: '#fff' }}>{selectedEvent.pid !== null ? `P${selectedEvent.pid}` : 'None'}</strong>
                </div>
              </div>

              {/* Event specific explanation */}
              {selectedEvent.type === 'deadlock_detected' && (
                <div style={{
                  padding: 10,
                  borderRadius: 'var(--radius-sm)',
                  background: selectedEvent.details.hasDeadlock ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                  fontSize: '0.75rem',
                  color: selectedEvent.details.hasDeadlock ? '#fca5a5' : '#6ee7b7'
                }}>
                  {selectedEvent.details.hasDeadlock ? (
                    <span>C++ Engine detected circular wait across: {selectedEvent.details.cycles?.map((c: string[]) => c.join(' → ')).join('; ')}</span>
                  ) : (
                    <span>C++ Engine verified resource allocation graph is acyclic.</span>
                  )}
                </div>
              )}

              {selectedEvent.type === 'banker_request_denied' && (
                <div style={{
                  padding: 10,
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  fontSize: '0.75rem',
                  color: '#fca5a5'
                }}>
                  Denied Reason: <strong>{selectedEvent.details.reason}</strong>
                </div>
              )}

              {/* Formatted JSON */}
              <pre className="mono-val" style={{
                background: '#070a12',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: 12,
                fontSize: '0.72rem',
                color: '#e2e8f0',
                overflowX: 'auto',
                maxHeight: 240
              }}>
                {JSON.stringify(selectedEvent, null, 2)}
              </pre>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.8rem' }}>
              Select an event from the log table to view structured details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncInspector;
