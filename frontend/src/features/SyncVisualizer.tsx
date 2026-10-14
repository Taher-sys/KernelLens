import React, { useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export const SyncVisualizer: React.FC = () => {
  const [subTab, setSubTab] = useState<'banker' | 'rag'>('banker');

  // Banker's Algorithm State (Silberschatz 5-process 3-resource benchmark)
  const [available, setAvailable] = useState<number[]>([3, 3, 2]);
  const [allocation, setAllocation] = useState<number[][]>([
    [0, 1, 0],
    [2, 0, 0],
    [3, 0, 2],
    [2, 1, 1],
    [0, 0, 2]
  ]);
  const [maxMatrix] = useState<number[][]>([
    [7, 5, 3],
    [3, 2, 2],
    [9, 0, 2],
    [2, 2, 2],
    [4, 3, 3]
  ]);

  const [reqPid, setReqPid] = useState(1);
  const [reqVector, setReqVector] = useState<number[]>([1, 0, 2]);
  const [evalResult, setEvalResult] = useState<{ granted: boolean; reason: string; seq?: number[] } | null>(null);

  // Compute Need Matrix
  const needMatrix = React.useMemo(() => {
    return maxMatrix.map((row, p) =>
      row.map((maxVal, r) => Math.max(0, maxVal - allocation[p][r]))
    );
  }, [maxMatrix, allocation]);

  // Banker Safety Check
  const safetyReport = React.useMemo(() => {
    const work = [...available];
    const finish = [false, false, false, false, false];
    const seq: number[] = [];

    let completed = 0;
    while (completed < 5) {
      let found = false;
      for (let i = 0; i < 5; ++i) {
        if (!finish[i]) {
          const canSatisfy = needMatrix[i].every((needVal, r) => needVal <= work[r]);
          if (canSatisfy) {
            for (let r = 0; r < 3; ++r) {
              work[r] += allocation[i][r];
            }
            finish[i] = true;
            seq.push(i);
            completed++;
            found = true;
          }
        }
      }
      if (!found) break;
    }

    return {
      isSafe: completed === 5,
      sequence: seq
    };
  }, [available, allocation, needMatrix]);

  function handleEvaluateRequest() {
    const p = reqPid;
    // Rule 1: Request <= Need
    for (let r = 0; r < 3; ++r) {
      if (reqVector[r] > needMatrix[p][r]) {
        setEvalResult({ granted: false, reason: `Process P${p} exceeded its maximum declared claim for resource R${r}` });
        return;
      }
    }
    // Rule 2: Request <= Available
    for (let r = 0; r < 3; ++r) {
      if (reqVector[r] > available[r]) {
        setEvalResult({ granted: false, reason: `Resource R${r} not available; process must wait.` });
        return;
      }
    }

    // Speculative allocation
    const testAvail = [...available];
    const testAlloc = allocation.map(row => [...row]);
    for (let r = 0; r < 3; ++r) {
      testAvail[r] -= reqVector[r];
      testAlloc[p][r] += reqVector[r];
    }

    const testNeed = maxMatrix.map((row, i) =>
      row.map((maxVal, r) => Math.max(0, maxVal - testAlloc[i][r]))
    );

    // Run safety check on speculative state
    const work = [...testAvail];
    const finish = [false, false, false, false, false];
    const seq: number[] = [];
    let completed = 0;

    while (completed < 5) {
      let found = false;
      for (let i = 0; i < 5; ++i) {
        if (!finish[i]) {
          const canSatisfy = testNeed[i].every((needVal, r) => needVal <= work[r]);
          if (canSatisfy) {
            for (let r = 0; r < 3; ++r) work[r] += testAlloc[i][r];
            finish[i] = true;
            seq.push(i);
            completed++;
            found = true;
          }
        }
      }
      if (!found) break;
    }

    if (completed === 5) {
      setEvalResult({
        granted: true,
        reason: 'Request granted safely. System remains in a safe state.',
        seq
      });
      // Apply allocation
      setAvailable(testAvail);
      setAllocation(testAlloc);
    } else {
      setEvalResult({
        granted: false,
        reason: 'Request DENIED: Allocating resources would lead to an UNSAFE state (potential deadlock).'
      });
    }
  }

  // RAG State
  const [hasDeadlockCycle, setHasDeadlockCycle] = useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => setSubTab('banker')}
          className={`btn-secondary ${subTab === 'banker' ? 'btn-active' : ''}`}
        >
          Banker’s Algorithm Avoidance Lab
        </button>
        <button
          onClick={() => setSubTab('rag')}
          className={`btn-secondary ${subTab === 'rag' ? 'btn-active' : ''}`}
        >
          Resource Allocation Graph (RAG)
        </button>
      </div>

      {subTab === 'banker' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
          {/* Matrices View */}
          <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={18} color="var(--primary-cyan)" />
                Resource Allocation & Safety Matrix (5 Processes, 3 Resources)
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>Available Vector:</span>
                <span className="badge badge-cyan mono-val" style={{ fontSize: '0.8rem' }}>
                  [{available.join(', ')}]
                </span>
              </div>
            </div>

            {/* Matrix Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-subtle)' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Process</th>
                    <th style={{ padding: '8px' }}>Allocation [A, B, C]</th>
                    <th style={{ padding: '8px' }}>Max Claim [A, B, C]</th>
                    <th style={{ padding: '8px' }}>Remaining Need [A, B, C]</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4].map(p => (
                    <tr key={p} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--primary-cyan)' }}>P{p}</td>
                      <td className="mono-val" style={{ padding: '10px 8px' }}>[{allocation[p].join(', ')}]</td>
                      <td className="mono-val" style={{ padding: '10px 8px' }}>[{maxMatrix[p].join(', ')}]</td>
                      <td className="mono-val" style={{ padding: '10px 8px', color: 'var(--accent-amber)', fontWeight: 600 }}>[{needMatrix[p].join(', ')}]</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Safety Result Badge */}
            <div style={{
              background: safetyReport.isSafe ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: safetyReport.isSafe ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              {safetyReport.isSafe ? (
                <CheckCircle size={22} color="var(--accent-emerald)" />
              ) : (
                <XCircle size={22} color="var(--accent-crimson)" />
              )}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: safetyReport.isSafe ? 'var(--accent-emerald)' : 'var(--accent-crimson)' }}>
                  {safetyReport.isSafe ? 'System is in a SAFE State' : 'System is in an UNSAFE State'}
                </h4>
                {safetyReport.isSafe && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Safe Execution Sequence: <span className="mono-val" style={{ color: '#fff', fontWeight: 700 }}>&lt;{safetyReport.sequence.map(p => `P${p}`).join(', ')}&gt;</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Request Sandbox Drawer */}
          <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Dynamic Request Tester</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
              Test resource requests from processes and observe Banker's evaluation in real time.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Select Process:</label>
                <select
                  value={reqPid}
                  onChange={e => setReqPid(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff' }}
                >
                  {[0, 1, 2, 3, 4].map(p => (
                    <option key={p} value={p}>Process P{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Request Vector [A, B, C]:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[0, 1, 2].map(r => (
                    <input
                      key={r}
                      type="number"
                      min={0}
                      max={10}
                      value={reqVector[r]}
                      onChange={e => {
                        const next = [...reqVector];
                        next[r] = Number(e.target.value);
                        setReqVector(next);
                      }}
                      style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', textAlign: 'center' }}
                    />
                  ))}
                </div>
              </div>

              <button onClick={handleEvaluateRequest} className="btn-primary" style={{ marginTop: 8, justifyContent: 'center' }}>
                Evaluate Request
              </button>
            </div>

            {evalResult && (
              <div style={{
                background: evalResult.granted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: evalResult.granted ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: 12,
                marginTop: 6
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {evalResult.granted ? <CheckCircle size={16} color="var(--accent-emerald)" /> : <XCircle size={16} color="var(--accent-crimson)" />}
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: evalResult.granted ? 'var(--accent-emerald)' : 'var(--accent-crimson)' }}>
                    {evalResult.granted ? 'REQUEST GRANTED' : 'REQUEST DENIED'}
                  </span>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {evalResult.reason}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* RAG Interactive View */
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
              Resource Allocation Graph (RAG) & Cycle Detector
            </h3>
            <button
              onClick={() => setHasDeadlockCycle(!hasDeadlockCycle)}
              className="btn-secondary"
            >
              <RefreshCw size={14} />
              <span>{hasDeadlockCycle ? 'Break Deadlock Cycle' : 'Inject Deadlock Cycle'}</span>
            </button>
          </div>

          <div style={{
            background: hasDeadlockCycle ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: hasDeadlockCycle ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            {hasDeadlockCycle ? <ShieldAlert size={20} color="var(--accent-crimson)" /> : <CheckCircle size={20} color="var(--accent-emerald)" />}
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: hasDeadlockCycle ? 'var(--accent-crimson)' : 'var(--accent-emerald)' }}>
              {hasDeadlockCycle ? 'DEADLOCK DETECTED: Cycle detected: P1 -> R1 -> P2 -> R2 -> P1' : 'NO DEADLOCK: Resource dependency graph is acyclic.'}
            </span>
          </div>

          {/* Interactive SVG RAG representation */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}>
            <svg width={500} height={220} viewBox="0 0 500 220">
              {/* Nodes */}
              {/* P1 */}
              <circle cx={100} cy={110} r={28} fill="rgba(0, 242, 254, 0.2)" stroke="var(--primary-cyan)" strokeWidth={2} />
              <text x={100} y={115} textAnchor="middle" fill="#fff" fontWeight="700" fontSize="14">P1</text>

              {/* R1 */}
              <rect x={190} y={40} width={48} height={48} rx={6} fill="rgba(139, 92, 246, 0.2)" stroke="var(--accent-purple)" strokeWidth={2} />
              <text x={214} y={70} textAnchor="middle" fill="#fff" fontWeight="700" fontSize="13">R1</text>

              {/* P2 */}
              <circle cx={330} cy={110} r={28} fill="rgba(0, 242, 254, 0.2)" stroke="var(--primary-cyan)" strokeWidth={2} />
              <text x={330} y={115} textAnchor="middle" fill="#fff" fontWeight="700" fontSize="14">P2</text>

              {/* R2 */}
              <rect x={190} y={140} width={48} height={48} rx={6} fill="rgba(139, 92, 246, 0.2)" stroke="var(--accent-purple)" strokeWidth={2} />
              <text x={214} y={170} textAnchor="middle" fill="#fff" fontWeight="700" fontSize="13">R2</text>

              {/* Edge P1 -> R1 (Request) */}
              <line x1={125} y1={95} x2={190} y2={65} stroke={hasDeadlockCycle ? 'var(--accent-crimson)' : 'var(--text-subtle)'} strokeWidth={2} markerEnd="url(#arrow)" />
              {/* Edge R1 -> P2 (Assignment) */}
              <line x1={238} y1={65} x2={305} y2={95} stroke={hasDeadlockCycle ? 'var(--accent-crimson)' : 'var(--text-subtle)'} strokeWidth={2} />
              {/* Edge P2 -> R2 (Request) */}
              {hasDeadlockCycle && (
                <line x1={305} y1={125} x2={238} y2={155} stroke="var(--accent-crimson)" strokeWidth={2} />
              )}
              {/* Edge R2 -> P1 (Assignment) */}
              <line x1={190} y1={155} x2={125} y2={125} stroke={hasDeadlockCycle ? 'var(--accent-crimson)' : 'var(--text-subtle)'} strokeWidth={2} />

              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#fff" />
                </marker>
              </defs>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
