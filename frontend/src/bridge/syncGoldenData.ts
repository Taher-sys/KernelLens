/**
 * KernelLens Phase 4 Synchronization Golden Datasets & Event Helpers
 * Derived directly from C++17 engine tests (tests/golden/test_golden_sync.cpp)
 * 
 * Strict rule: NEVER implement deadlock/cycle detection in TypeScript.
 * All cycles, deadlocks, and safe sequences originate from engine events.
 */

import {
  SimEvent,
  RagEdgeKind,
  DeadlockDetectedDetails,
  BankerProcessSnapshot,
  BankerStepState
} from './schema';

export interface RagNode {
  id: string;
  type: 'process' | 'resource';
  label: string;
  instances?: number;
  inCycle?: boolean;
}

export interface RagEdge {
  id: string;
  from: string;
  to: string;
  kind: RagEdgeKind;
  inCycle?: boolean;
}

export interface RagGraphState {
  nodes: RagNode[];
  edges: RagEdge[];
  deadlock: DeadlockDetectedDetails;
  cycleEdges: Set<string>; // "from->to" keys in detected cycle
  cycleNodes: Set<string>; // node IDs in detected cycle
}

/**
 * Reconstructs RAG nodes and edges from engine events up to a given tick.
 * Identifies cycle participants strictly from the engine's `deadlock_detected` event.
 */
export function replayRagState(events: SimEvent[], targetTick?: number): RagGraphState {
  const nodeMap = new Map<string, RagNode>();
  const edgeMap = new Map<string, RagEdge>();
  let deadlock: DeadlockDetectedDetails = {
    hasDeadlock: false,
    cycleCount: 0,
    cycles: []
  };

  const filtered = targetTick !== undefined ? events.filter(e => e.time <= targetTick) : events;

  for (const ev of filtered) {
    if (ev.subsystem !== 'sync') continue;

    if (ev.type === 'rag_edge_added') {
      const { from, to, kind } = ev.details as { from: string; to: string; kind: RagEdgeKind };
      
      // Ensure process node exists
      const pId = kind === 'REQUEST' ? from : to;
      if (!nodeMap.has(pId)) {
        nodeMap.set(pId, { id: pId, type: 'process', label: pId });
      }

      // Ensure resource node exists
      const rId = kind === 'REQUEST' ? to : from;
      if (!nodeMap.has(rId)) {
        nodeMap.set(rId, { id: rId, type: 'resource', label: rId, instances: 1 });
      }

      const edgeKey = `${from}->${to}`;
      edgeMap.set(edgeKey, {
        id: edgeKey,
        from,
        to,
        kind
      });
    } else if (ev.type === 'rag_edge_removed') {
      const { from, to } = ev.details as { from: string; to: string };
      const edgeKey = `${from}->${to}`;
      edgeMap.delete(edgeKey);
    } else if (ev.type === 'deadlock_detected') {
      // Direct engine report - NO UI cycle detection
      deadlock = {
        hasDeadlock: Boolean(ev.details.hasDeadlock),
        cycleCount: Number(ev.details.cycleCount ?? ev.details.cycles?.length ?? 0),
        cycles: Array.isArray(ev.details.cycles) ? ev.details.cycles : []
      };
    }
  }

  // Extract cycle node and edge sets strictly from engine report
  const cycleNodes = new Set<string>();
  const cycleEdges = new Set<string>();

  if (deadlock.hasDeadlock && deadlock.cycles.length > 0) {
    for (const cycle of deadlock.cycles) {
      for (let i = 0; i < cycle.length; ++i) {
        cycleNodes.add(cycle[i]);
        if (i < cycle.length - 1) {
          cycleEdges.add(`${cycle[i]}->${cycle[i + 1]}`);
        }
      }
    }
  }

  const nodes = Array.from(nodeMap.values()).map(n => ({
    ...n,
    inCycle: cycleNodes.has(n.id)
  }));

  const edges = Array.from(edgeMap.values()).map(e => ({
    ...e,
    inCycle: cycleEdges.has(`${e.from}->${e.to}`)
  }));

  return {
    nodes,
    edges,
    deadlock,
    cycleEdges,
    cycleNodes
  };
}

// -------------------------------------------------------------
// Golden Scenario 1: Deadlock Cycle (P1 -> R1 -> P2 -> R2 -> P1)
// -------------------------------------------------------------
export const GOLDEN_RAG_DEADLOCK_EVENTS: SimEvent[] = [
  {
    schemaVersion: 1,
    runId: 'golden-rag-deadlock',
    seq: 0,
    time: 1,
    subsystem: 'sync',
    type: 'rag_edge_added',
    pid: 1,
    details: { from: 'P1', to: 'R1', kind: 'REQUEST' }
  },
  {
    schemaVersion: 1,
    runId: 'golden-rag-deadlock',
    seq: 1,
    time: 2,
    subsystem: 'sync',
    type: 'rag_edge_added',
    pid: 2,
    details: { from: 'R1', to: 'P2', kind: 'ASSIGNMENT' }
  },
  {
    schemaVersion: 1,
    runId: 'golden-rag-deadlock',
    seq: 2,
    time: 3,
    subsystem: 'sync',
    type: 'rag_edge_added',
    pid: 2,
    details: { from: 'P2', to: 'R2', kind: 'REQUEST' }
  },
  {
    schemaVersion: 1,
    runId: 'golden-rag-deadlock',
    seq: 3,
    time: 4,
    subsystem: 'sync',
    type: 'rag_edge_added',
    pid: 1,
    details: { from: 'R2', to: 'P1', kind: 'ASSIGNMENT' }
  },
  {
    schemaVersion: 1,
    runId: 'golden-rag-deadlock',
    seq: 4,
    time: 5,
    subsystem: 'sync',
    type: 'deadlock_detected',
    pid: null,
    details: {
      hasDeadlock: true,
      cycleCount: 1,
      cycles: [['P1', 'R1', 'P2', 'R2', 'P1']]
    }
  }
];

// -------------------------------------------------------------
// Golden Scenario 2: Deadlock Resolved / Acyclic (Cycle Broken)
// -------------------------------------------------------------
export const GOLDEN_RAG_RESOLVED_EVENTS: SimEvent[] = [
  ...GOLDEN_RAG_DEADLOCK_EVENTS.slice(0, 4),
  {
    schemaVersion: 1,
    runId: 'golden-rag-resolved',
    seq: 4,
    time: 5,
    subsystem: 'sync',
    type: 'rag_edge_removed',
    pid: 2,
    details: { from: 'P2', to: 'R2', kind: 'REQUEST' }
  },
  {
    schemaVersion: 1,
    runId: 'golden-rag-resolved',
    seq: 5,
    time: 6,
    subsystem: 'sync',
    type: 'deadlock_detected',
    pid: null,
    details: {
      hasDeadlock: false,
      cycleCount: 0,
      cycles: []
    }
  }
];

// -------------------------------------------------------------
// Golden Scenario 3: Complex Multi-Resource Graph (Safe / No Deadlock)
// -------------------------------------------------------------
export const GOLDEN_RAG_COMPLEX_SAFE_EVENTS: SimEvent[] = [
  {
    schemaVersion: 1,
    runId: 'golden-rag-complex',
    seq: 0,
    time: 1,
    subsystem: 'sync',
    type: 'rag_edge_added',
    pid: 1,
    details: { from: 'P1', to: 'R1', kind: 'REQUEST' }
  },
  {
    schemaVersion: 1,
    runId: 'golden-rag-complex',
    seq: 1,
    time: 2,
    subsystem: 'sync',
    type: 'rag_edge_added',
    pid: 2,
    details: { from: 'R1', to: 'P2', kind: 'ASSIGNMENT' }
  },
  {
    schemaVersion: 1,
    runId: 'golden-rag-complex',
    seq: 2,
    time: 3,
    subsystem: 'sync',
    type: 'rag_edge_added',
    pid: 2,
    details: { from: 'P2', to: 'R2', kind: 'REQUEST' }
  },
  {
    schemaVersion: 1,
    runId: 'golden-rag-complex',
    seq: 3,
    time: 4,
    subsystem: 'sync',
    type: 'rag_edge_added',
    pid: 3,
    details: { from: 'R2', to: 'P3', kind: 'ASSIGNMENT' }
  },
  {
    schemaVersion: 1,
    runId: 'golden-rag-complex',
    seq: 4,
    time: 5,
    subsystem: 'sync',
    type: 'rag_edge_added',
    pid: 3,
    details: { from: 'P3', to: 'R3', kind: 'REQUEST' }
  },
  {
    schemaVersion: 1,
    runId: 'golden-rag-complex',
    seq: 5,
    time: 6,
    subsystem: 'sync',
    type: 'deadlock_detected',
    pid: null,
    details: {
      hasDeadlock: false,
      cycleCount: 0,
      cycles: []
    }
  }
];

// -------------------------------------------------------------
// Banker's Algorithm Golden Benchmark (Silberschatz 5P x 3R)
// -------------------------------------------------------------
export interface BankerScenarioData {
  title: string;
  description: string;
  available: number[];
  resources: string[];
  processes: BankerProcessSnapshot[];
  safeSequence: number[];
  isSafe: boolean;
  steps: BankerStepState[];
  events: SimEvent[];
}

export const GOLDEN_BANKER_SILBERSCHATZ: BankerScenarioData = (() => {
  const initialAvailable = [3, 3, 2];
  const resources = ['A', 'B', 'C'];
  const initialProcesses: BankerProcessSnapshot[] = [
    { pid: 0, allocation: [0, 1, 0], max: [7, 5, 3], need: [7, 4, 3] },
    { pid: 1, allocation: [2, 0, 0], max: [3, 2, 2], need: [1, 2, 2] },
    { pid: 2, allocation: [3, 0, 2], max: [9, 0, 2], need: [6, 0, 0] },
    { pid: 3, allocation: [2, 1, 1], max: [2, 2, 2], need: [0, 1, 1] },
    { pid: 4, allocation: [0, 0, 2], max: [4, 3, 3], need: [4, 3, 1] }
  ];

  const safeSequence = [1, 3, 4, 0, 2];

  // Precomputed stepper states according to C++ check_safety()
  const steps: BankerStepState[] = [
    {
      stepIndex: 0,
      currentPid: null,
      workBefore: [3, 3, 2],
      workAfter: [3, 3, 2],
      releasedAllocation: [0, 0, 0],
      processes: initialProcesses.map(p => ({ ...p, finished: false }))
    },
    {
      stepIndex: 1,
      currentPid: 1,
      workBefore: [3, 3, 2],
      workAfter: [5, 3, 2],
      releasedAllocation: [2, 0, 0],
      processes: initialProcesses.map(p => ({ ...p, finished: p.pid === 1 }))
    },
    {
      stepIndex: 2,
      currentPid: 3,
      workBefore: [5, 3, 2],
      workAfter: [7, 4, 3],
      releasedAllocation: [2, 1, 1],
      processes: initialProcesses.map(p => ({ ...p, finished: p.pid === 1 || p.pid === 3 }))
    },
    {
      stepIndex: 3,
      currentPid: 4,
      workBefore: [7, 4, 3],
      workAfter: [7, 4, 5],
      releasedAllocation: [0, 0, 2],
      processes: initialProcesses.map(p => ({ ...p, finished: p.pid === 1 || p.pid === 3 || p.pid === 4 }))
    },
    {
      stepIndex: 4,
      currentPid: 0,
      workBefore: [7, 4, 5],
      workAfter: [7, 5, 5],
      releasedAllocation: [0, 1, 0],
      processes: initialProcesses.map(p => ({ ...p, finished: p.pid !== 2 }))
    },
    {
      stepIndex: 5,
      currentPid: 2,
      workBefore: [7, 5, 5],
      workAfter: [10, 5, 7],
      releasedAllocation: [3, 0, 2],
      processes: initialProcesses.map(p => ({ ...p, finished: true }))
    }
  ];

  const events: SimEvent[] = [
    {
      schemaVersion: 1,
      runId: 'golden-banker-silberschatz',
      seq: 0,
      time: 0,
      subsystem: 'sync',
      type: 'banker_safety_checked',
      pid: null,
      details: {
        isSafe: true,
        safeSequence: [1, 3, 4, 0, 2],
        explanation: 'System is in a SAFE state. Safe execution sequence: <P1, P3, P4, P0, P2>'
      }
    },
    {
      schemaVersion: 1,
      runId: 'golden-banker-silberschatz',
      seq: 1,
      time: 10,
      subsystem: 'sync',
      type: 'banker_request_granted',
      pid: 1,
      details: {
        granted: true,
        request: [1, 0, 2],
        safeSequence: [1, 3, 4, 0, 2],
        reason: 'Request granted safely. System is in a SAFE state. Safe execution sequence: <P1, P3, P4, P0, P2>'
      }
    },
    {
      schemaVersion: 1,
      runId: 'golden-banker-silberschatz',
      seq: 2,
      time: 20,
      subsystem: 'sync',
      type: 'banker_request_denied',
      pid: 4,
      details: {
        granted: false,
        request: [3, 3, 0],
        safeSequence: [],
        reason: 'Resources not available; process must wait'
      }
    },
    {
      schemaVersion: 1,
      runId: 'golden-banker-silberschatz',
      seq: 3,
      time: 30,
      subsystem: 'sync',
      type: 'banker_request_denied',
      pid: 0,
      details: {
        granted: false,
        request: [0, 2, 0],
        safeSequence: [],
        reason: 'Request would result in an UNSAFE state. Process must wait.'
      }
    }
  ];

  return {
    title: "Silberschatz 5-Process 3-Resource Benchmark",
    description: "Classic textbook avoidance problem. P1 requests [1,0,2] (granted), P4 requests [3,3,0] (denied: insufficient available), P0 requests [0,2,0] (denied: leaves system in unsafe state).",
    available: initialAvailable,
    resources,
    processes: initialProcesses,
    safeSequence,
    isSafe: true,
    steps,
    events
  };
})();
