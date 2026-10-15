/**
 * KernelLens Replay Reducer & Deterministic Checkpoint State Machine
 *
 * Implements discrete-event time-travel scrubbing:
 * - Scrubbing backward reconstructs state by replaying forward from the nearest checkpoint.
 * - Zero invented reverse mutations: deterministic forward-replay strictly preserves engine invariants.
 * - Enforces schemaVersion: 1 contract.
 */

import {
  SCHEMA_VERSION,
  assertSchemaVersion,
  SimEvent,
  ProcessSpec,
  ReplayState,
  ReplayAction,
  ReplayCheckpoint,
  ReplayEngineState,
  ProcessRuntimeSnapshot
} from '../bridge/schema';

/**
 * Creates the clean initial engine state at tick 0.
 */
export function createInitialEngineState(processes: ProcessSpec[] = []): ReplayEngineState {
  const processSnapshots: Record<number, ProcessRuntimeSnapshot> = {};

  for (const p of processes) {
    const firstBurst = p.bursts && p.bursts.length > 0 ? p.bursts[0].duration : 0;
    processSnapshots[p.pid] = {
      pid: p.pid,
      state: 'NEW',
      currentBurstRemaining: firstBurst,
      totalCpuTime: 0,
      totalWaitTime: 0,
      lastStateChangeTick: 0
    };
  }

  return {
    currentTick: 0,
    runningPid: null,
    readyQueue: [],
    waitingQueue: [],
    terminatedPids: [],
    processes: processSnapshots,
    metrics: {
      contextSwitches: 0,
      cpuBusyTicks: 0,
      totalTicks: 0
    },
    customSubsystemState: {}
  };
}

/**
 * Deep-clones an engine state object to guarantee checkpoint immutability.
 */
export function cloneEngineState(state: ReplayEngineState): ReplayEngineState {
  return {
    currentTick: state.currentTick,
    runningPid: state.runningPid,
    readyQueue: [...state.readyQueue],
    waitingQueue: [...state.waitingQueue],
    terminatedPids: [...state.terminatedPids],
    processes: Object.fromEntries(
      Object.entries(state.processes).map(([pid, p]) => [
        Number(pid),
        { ...p }
      ])
    ),
    metrics: { ...state.metrics },
    customSubsystemState: state.customSubsystemState
      ? JSON.parse(JSON.stringify(state.customSubsystemState))
      : {}
  };
}

/**
 * Applies a single discrete simulation event to mutate state forward deterministically.
 */
export function applyEvent(state: ReplayEngineState, event: SimEvent): ReplayEngineState {
  state.currentTick = event.time;

  const pid = event.pid;

  switch (event.type) {
    case 'PROCESS_ARRIVED': {
      if (pid !== null) {
        if (!state.processes[pid]) {
          state.processes[pid] = {
            pid,
            state: 'READY',
            currentBurstRemaining: event.details?.burstRemaining ?? event.details?.burst ?? 0,
            totalCpuTime: 0,
            totalWaitTime: 0,
            lastStateChangeTick: event.time
          };
        } else {
          state.processes[pid].state = 'READY';
          state.processes[pid].lastStateChangeTick = event.time;
        }
        if (!state.readyQueue.includes(pid)) {
          state.readyQueue.push(pid);
        }
      }
      break;
    }

    case 'DISPATCH':
    case 'CONTEXT_SWITCH': {
      state.metrics.contextSwitches += 1;
      const newPid = pid ?? event.details?.toPid ?? event.details?.pid ?? null;

      // Handle previous running process
      if (state.runningPid !== null && state.runningPid !== newPid) {
        const prevProc = state.processes[state.runningPid];
        if (prevProc && prevProc.state === 'RUNNING') {
          prevProc.state = 'READY';
          prevProc.lastStateChangeTick = event.time;
          if (!state.readyQueue.includes(state.runningPid)) {
            state.readyQueue.push(state.runningPid);
          }
        }
      }

      state.runningPid = newPid;
      if (newPid !== null) {
        state.readyQueue = state.readyQueue.filter(p => p !== newPid);
        if (state.processes[newPid]) {
          state.processes[newPid].state = 'RUNNING';
          state.processes[newPid].lastStateChangeTick = event.time;
        }
      }
      break;
    }

    case 'PREEMPT':
    case 'QUANTUM_EXPIRED': {
      const targetPid = pid ?? state.runningPid;
      if (targetPid !== null && state.processes[targetPid]) {
        state.processes[targetPid].state = 'READY';
        state.processes[targetPid].lastStateChangeTick = event.time;
        if (!state.readyQueue.includes(targetPid)) {
          state.readyQueue.push(targetPid);
        }
      }
      if (state.runningPid === targetPid) {
        state.runningPid = null;
      }
      break;
    }

    case 'PROCESS_TERMINATED':
    case 'PROCESS_COMPLETED': {
      const termPid = pid ?? state.runningPid;
      if (termPid !== null) {
        if (state.processes[termPid]) {
          state.processes[termPid].state = 'TERMINATED';
          state.processes[termPid].currentBurstRemaining = 0;
          state.processes[termPid].lastStateChangeTick = event.time;
        }
        if (!state.terminatedPids.includes(termPid)) {
          state.terminatedPids.push(termPid);
        }
        state.readyQueue = state.readyQueue.filter(p => p !== termPid);
        state.waitingQueue = state.waitingQueue.filter(p => p !== termPid);
        if (state.runningPid === termPid) {
          state.runningPid = null;
        }
      }
      break;
    }

    case 'IO_BURST_STARTED':
    case 'WAIT_LOCK': {
      const waitPid = pid ?? state.runningPid;
      if (waitPid !== null) {
        if (state.processes[waitPid]) {
          state.processes[waitPid].state = 'WAITING';
          state.processes[waitPid].lastStateChangeTick = event.time;
        }
        if (!state.waitingQueue.includes(waitPid)) {
          state.waitingQueue.push(waitPid);
        }
        state.readyQueue = state.readyQueue.filter(p => p !== waitPid);
        if (state.runningPid === waitPid) {
          state.runningPid = null;
        }
      }
      break;
    }

    case 'IO_BURST_COMPLETED':
    case 'SIGNAL_LOCK': {
      const resumePid = pid ?? event.details?.pid;
      if (resumePid !== undefined && resumePid !== null) {
        state.waitingQueue = state.waitingQueue.filter(p => p !== resumePid);
        if (state.processes[resumePid]) {
          state.processes[resumePid].state = 'READY';
          state.processes[resumePid].lastStateChangeTick = event.time;
        }
        if (!state.readyQueue.includes(resumePid) && !state.terminatedPids.includes(resumePid)) {
          state.readyQueue.push(resumePid);
        }
      }
      break;
    }

    case 'PAGE_FAULT':
    case 'FRAME_EVICTED':
    case 'PAGE_LOADED':
    case 'PAGE_HIT':
    case 'TLB_HIT':
    case 'TLB_MISS': {
      // Memory subsystem event tracking
      if (!state.customSubsystemState) state.customSubsystemState = {};
      if (!state.customSubsystemState.memory) {
        state.customSubsystemState.memory = { pageFaults: 0, hits: 0, tlbHits: 0 };
      }
      if (event.type === 'PAGE_FAULT') state.customSubsystemState.memory.pageFaults += 1;
      if (event.type === 'PAGE_HIT') state.customSubsystemState.memory.hits += 1;
      if (event.type === 'TLB_HIT') state.customSubsystemState.memory.tlbHits += 1;
      break;
    }

    case 'DISK_SEEK_START':
    case 'DISK_SEEK_COMPLETE': {
      // Disk subsystem event tracking
      if (!state.customSubsystemState) state.customSubsystemState = {};
      if (!state.customSubsystemState.disk) {
        state.customSubsystemState.disk = { headPosition: event.details?.toCylinder ?? 0, totalSeek: 0 };
      }
      if (event.details?.accumulatedSeek !== undefined) {
        state.customSubsystemState.disk.totalSeek = event.details.accumulatedSeek;
      }
      if (event.details?.toCylinder !== undefined) {
        state.customSubsystemState.disk.headPosition = event.details.toCylinder;
      }
      break;
    }

    case 'RAG_EDGE_ADDED':
    case 'RAG_EDGE_REMOVED':
    case 'DEADLOCK_DETECTED': {
      // Sync subsystem event tracking
      if (!state.customSubsystemState) state.customSubsystemState = {};
      if (!state.customSubsystemState.sync) {
        state.customSubsystemState.sync = { hasDeadlock: false, cycles: [] };
      }
      if (event.type === 'DEADLOCK_DETECTED') {
        state.customSubsystemState.sync.hasDeadlock = event.details?.hasDeadlock ?? false;
        state.customSubsystemState.sync.cycles = event.details?.cycles ?? [];
      }
      break;
    }

    default:
      // Other events update tick monotonic time
      break;
  }

  return state;
}

/**
 * Builds periodic snapshot checkpoints across the event log.
 * Default interval: every 15 simulation ticks or 25 events.
 */
export function buildCheckpoints(
  events: SimEvent[],
  checkpointInterval: number = 15,
  processes: ProcessSpec[] = []
): ReplayCheckpoint[] {
  const checkpoints: ReplayCheckpoint[] = [];

  // Checkpoint 0 at tick 0
  let currentState = createInitialEngineState(processes);
  checkpoints.push({
    tick: 0,
    eventIndex: 0,
    state: cloneEngineState(currentState)
  });

  if (!events || events.length === 0) {
    return checkpoints;
  }

  let lastCheckpointTick = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    currentState = applyEvent(currentState, event);

    if (
      event.time - lastCheckpointTick >= checkpointInterval ||
      i === events.length - 1
    ) {
      checkpoints.push({
        tick: event.time,
        eventIndex: i + 1,
        state: cloneEngineState(currentState)
      });
      lastCheckpointTick = event.time;
    }
  }

  return checkpoints;
}

/**
 * Reconstructs the exact simulation state at targetTick.
 *
 * CRITICAL INVARIANT:
 * Scrubbing backward reconstructs state by finding the nearest checkpoint <= targetTick
 * and replaying events forward. NO REVERSE MUTATIONS ARE EVER INVENTED.
 */
export function reconstructStateAtTick(
  targetTick: number,
  events: SimEvent[],
  checkpoints: ReplayCheckpoint[],
  processes: ProcessSpec[] = []
): { state: ReplayEngineState; activeEvents: SimEvent[] } {
  const safeTargetTick = Math.max(0, targetTick);

  // If no checkpoints, build from initial state
  if (!checkpoints || checkpoints.length === 0) {
    let state = createInitialEngineState(processes);
    const activeEvents: SimEvent[] = [];
    for (const ev of events) {
      if (ev.time <= safeTargetTick) {
        state = applyEvent(state, ev);
        activeEvents.push(ev);
      } else {
        break;
      }
    }
    state.currentTick = safeTargetTick;
    return { state, activeEvents };
  }

  // Find nearest checkpoint <= safeTargetTick
  let baseCheckpoint = checkpoints[0];
  for (let i = checkpoints.length - 1; i >= 0; i--) {
    if (checkpoints[i].tick <= safeTargetTick) {
      baseCheckpoint = checkpoints[i];
      break;
    }
  }

  // Clone checkpoint state
  let state = cloneEngineState(baseCheckpoint.state);

  // Replay forward from baseCheckpoint.eventIndex up to safeTargetTick
  for (let i = baseCheckpoint.eventIndex; i < events.length; i++) {
    const ev = events[i];
    if (ev.time <= safeTargetTick) {
      state = applyEvent(state, ev);
    } else {
      break;
    }
  }

  state.currentTick = safeTargetTick;
  const activeEvents = events.filter(e => e.time <= safeTargetTick);

  return { state, activeEvents };
}

/**
 * Initial empty replay state
 */
export const initialReplayState: ReplayState = {
  schemaVersion: SCHEMA_VERSION,
  status: 'idle',
  runId: null,
  events: [],
  currentTick: 0,
  maxTick: 0,
  playbackSpeed: 1,
  checkpoints: [],
  currentState: createInitialEngineState([]),
  activeEvents: [],
  error: null,
  loading: false,
  workloadProcesses: []
};

/**
 * Replay Reducer State Machine
 */
export function replayReducer(state: ReplayState, action: ReplayAction): ReplayState {
  switch (action.type) {
    case 'LOAD_START': {
      return {
        ...state,
        loading: true,
        error: null,
        status: 'loading'
      };
    }

    case 'LOAD_SUCCESS': {
      const { response, processes } = action.payload;

      // Strict schemaVersion validation guard
      try {
        assertSchemaVersion(response.schemaVersion);
      } catch (err: any) {
        return {
          ...state,
          loading: false,
          error: err.message || 'Invalid response schemaVersion',
          status: 'error'
        };
      }

      const checkpoints = buildCheckpoints(
        response.events,
        15,
        processes || state.workloadProcesses || []
      );

      const reconstructed = reconstructStateAtTick(
        0,
        response.events,
        checkpoints,
        processes || state.workloadProcesses || []
      );

      return {
        ...state,
        schemaVersion: response.schemaVersion,
        runId: response.runId,
        events: response.events,
        currentTick: 0,
        maxTick: response.simulatedDuration,
        checkpoints,
        currentState: reconstructed.state,
        activeEvents: reconstructed.activeEvents,
        workloadProcesses: processes || state.workloadProcesses,
        loading: false,
        error: null,
        status: 'paused'
      };
    }

    case 'LOAD_ERROR': {
      return {
        ...state,
        loading: false,
        error: action.payload.error,
        status: 'error'
      };
    }

    case 'PLAY': {
      if (state.currentTick >= state.maxTick) {
        // Rewind to 0 if at end and play
        const rec = reconstructStateAtTick(
          0,
          state.events,
          state.checkpoints,
          state.workloadProcesses
        );
        return {
          ...state,
          currentTick: 0,
          currentState: rec.state,
          activeEvents: rec.activeEvents,
          status: 'playing'
        };
      }
      return {
        ...state,
        status: 'playing'
      };
    }

    case 'PAUSE': {
      return {
        ...state,
        status: 'paused'
      };
    }

    case 'TICK_FORWARD': {
      if (state.currentTick >= state.maxTick) {
        return {
          ...state,
          status: 'completed'
        };
      }

      const targetTick = state.currentTick + 1;
      const rec = reconstructStateAtTick(
        targetTick,
        state.events,
        state.checkpoints,
        state.workloadProcesses
      );

      return {
        ...state,
        currentTick: targetTick,
        currentState: rec.state,
        activeEvents: rec.activeEvents,
        status: targetTick >= state.maxTick ? 'completed' : state.status
      };
    }

    case 'STEP_FORWARD': {
      if (state.currentTick >= state.maxTick) {
        return { ...state, status: 'completed' };
      }

      // Step to next event tick or tick + 1
      const nextEvent = state.events.find(e => e.time > state.currentTick);
      const targetTick = nextEvent
        ? nextEvent.time
        : Math.min(state.maxTick, state.currentTick + 1);

      const rec = reconstructStateAtTick(
        targetTick,
        state.events,
        state.checkpoints,
        state.workloadProcesses
      );

      return {
        ...state,
        currentTick: targetTick,
        currentState: rec.state,
        activeEvents: rec.activeEvents,
        status: targetTick >= state.maxTick ? 'completed' : 'paused'
      };
    }

    case 'STEP_BACKWARD': {
      if (state.currentTick <= 0) {
        return state;
      }

      // Step to previous event tick or tick - 1
      const prevEvents = state.events.filter(e => e.time < state.currentTick);
      const targetTick = prevEvents.length > 0
        ? prevEvents[prevEvents.length - 1].time
        : Math.max(0, state.currentTick - 1);

      // Reconstruct strictly by replaying from the nearest checkpoint
      const rec = reconstructStateAtTick(
        targetTick,
        state.events,
        state.checkpoints,
        state.workloadProcesses
      );

      return {
        ...state,
        currentTick: targetTick,
        currentState: rec.state,
        activeEvents: rec.activeEvents,
        status: 'paused'
      };
    }

    case 'SCRUB_TO_TICK': {
      const targetTick = Math.max(
        0,
        Math.min(state.maxTick, Math.round(action.payload.tick))
      );

      // Reconstruct strictly by replaying from the nearest checkpoint <= targetTick
      const rec = reconstructStateAtTick(
        targetTick,
        state.events,
        state.checkpoints,
        state.workloadProcesses
      );

      return {
        ...state,
        currentTick: targetTick,
        currentState: rec.state,
        activeEvents: rec.activeEvents,
        status: targetTick >= state.maxTick ? 'completed' : 'paused'
      };
    }

    case 'SET_SPEED': {
      return {
        ...state,
        playbackSpeed: action.payload.speed
      };
    }

    case 'RESET': {
      const rec = reconstructStateAtTick(
        0,
        state.events,
        state.checkpoints,
        state.workloadProcesses
      );

      return {
        ...state,
        currentTick: 0,
        currentState: rec.state,
        activeEvents: rec.activeEvents,
        status: 'paused'
      };
    }

    default:
      return state;
  }
}
