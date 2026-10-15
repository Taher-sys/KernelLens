/**
 * Canonical Schema Version constant enforced across engine and frontend (schemaVersion: 1)
 */
export const SCHEMA_VERSION = 1;

/**
 * Validates that an incoming or outgoing schema version strictly matches the supported schemaVersion (1).
 */
export function validateSchemaVersion(version: unknown): boolean {
  return version === SCHEMA_VERSION;
}

/**
 * Guard that throws an explicit Error if schemaVersion is missing or unsupported.
 */
export function assertSchemaVersion(version: unknown): void {
  if (version !== SCHEMA_VERSION) {
    throw new Error(
      `Schema validation error: unsupported schemaVersion ${JSON.stringify(version)}. Expected schemaVersion: ${SCHEMA_VERSION}.`
    );
  }
}

export type Subsystem = 'cpu' | 'memory' | 'sync' | 'disk' | 'filesystem' | 'system';

export interface SimEvent {
  schemaVersion: number;
  runId: string;
  seq: number;
  time: number; // Integer simulation tick (int64_t)
  subsystem: Subsystem;
  type: string;
  pid: number | null;
  details: Record<string, any>;
}

export interface BurstSegment {
  kind: 'CPU' | 'IO';
  duration: number;
}

export interface ProcessSpec {
  pid: number;
  arrivalTime: number;
  bursts: BurstSegment[];
  basePriority: number;
  niceValue: number;
}

export interface ProcessMetric {
  pid: number;
  waitingTime: number;
  turnaroundTime: number;
  responseTime: number;
  cpuService: number;
}

export interface AverageMetrics {
  waitingTime: number;
  turnaroundTime: number;
  responseTime: number;
}

export interface SimulationMetrics {
  perProcess: ProcessMetric[];
  averages: AverageMetrics;
  throughput: number;
  cpuUtilization: number;
  contextSwitches: number;
  jainFairness: number | null;
}

export type CpuPolicy = 'FCFS' | 'SJF' | 'SRTF' | 'PRIORITY' | 'ROUND_ROBIN' | 'MLFQ' | 'CFS_LIKE';
export type MemoryPolicy = 'FIFO' | 'LRU' | 'OPTIMAL' | 'CLOCK';
export type DiskPolicy = 'FCFS' | 'SSTF' | 'SCAN' | 'C-SCAN' | 'LOOK' | 'C-LOOK';

/**
 * Memory Subsystem Contract (docs/event-schema.md Section 2.2)
 */
export interface MemoryMetrics {
  totalAccesses: number;
  pageFaults: number;
  tlbHits: number;
  tlbMisses: number;
  faultRate: number; // 0.0 to 1.0
  tlbHitRate: number; // 0.0 to 1.0
}

export interface FrameState {
  frameId: number;
  page: number | null;
  loadedAt: number;
  lastUsedAt: number;
  referenceBit?: boolean;
  isVictim?: boolean;
  isHit?: boolean;
}

export interface TlbEntry {
  page: number;
  frame: number;
  lastAccess: number;
}

export interface PageFaultDetails {
  page: number;
  frame?: number;
  policy?: string;
  freeFramesAvailable?: number;
}

export interface FrameEvictedDetails {
  frame: number;
  evictedPage: number;
  policy?: string;
  reason?: string;
}

export interface FrameLoadedDetails {
  page: number;
  frame: number;
}

export interface PageAccessDetails {
  page: number;
  frame?: number;
  isHit?: boolean;
  isWrite?: boolean;
}

export interface TlbEventDetails {
  page: number;
  frame?: number;
}

export interface MemoryAccessStep {
  tick: number;
  page: number;
  isPageFault: boolean;
  isTlbHit: boolean;
  frameIndex: number;
  evictedPage: number | null;
  frames: FrameState[];
  tlb: TlbEntry[];
}

export interface SimulationOptions {
  quantum?: number;
  preemptive?: boolean;
  agingInterval?: number;
  contextSwitchCost?: number;
  emitDetailedEvents?: boolean;
  numFrames?: number;
  tlbCapacity?: number;
}

export interface SimulationRequest {
  schemaVersion: number;
  runId: string;
  seed: number;
  module: Subsystem;
  policy: {
    name: string;
    quantum?: number;
    [key: string]: any;
  };
  workload: {
    processes?: ProcessSpec[];
    references?: number[];
    [key: string]: any;
  };
  options?: SimulationOptions;
}

export interface SimulationResponse {
  schemaVersion: number;
  runId: string;
  status: 'completed' | 'error' | 'not_connected';
  simulatedDuration: number;
  events: SimEvent[];
  metrics: SimulationMetrics;
  memoryMetrics?: MemoryMetrics;
  warnings?: string[];
  errorMessage?: string;
}

export interface MemorySimulationResponse {
  schemaVersion: number;
  runId: string;
  status: 'completed' | 'error' | 'not_connected';
  simulatedDuration: number;
  events: SimEvent[];
  metrics: MemoryMetrics;
  steps: MemoryAccessStep[];
  warnings?: string[];
  errorMessage?: string;
}

/**
 * Synchronization & Deadlock Subsystem Contract (Phase 4 / docs/event-schema.md Section 2.3)
 */
export type RagEdgeKind = 'REQUEST' | 'ASSIGNMENT';

export interface RagEdgeAddedDetails {
  from: string;
  to: string;
  kind: RagEdgeKind;
}

export interface RagEdgeRemovedDetails {
  from: string;
  to: string;
  kind: RagEdgeKind;
}

export interface DeadlockDetectedDetails {
  hasDeadlock: boolean;
  cycleCount: number;
  cycles: string[][];
}

export interface BankerRequestGrantedDetails {
  granted: true;
  reason: string;
  safeSequence: number[];
  request?: number[];
}

export interface BankerRequestDeniedDetails {
  granted: false;
  reason: string;
  safeSequence: number[];
  request?: number[];
}

export interface BankerProcessSnapshot {
  pid: number;
  allocation: number[];
  max: number[];
  need: number[];
  finished?: boolean;
}

export interface BankerStepState {
  stepIndex: number;
  currentPid: number | null;
  workBefore: number[];
  workAfter: number[];
  releasedAllocation: number[];
  processes: BankerProcessSnapshot[];
}

export interface SyncSimulationResponse {
  schemaVersion: number;
  runId: string;
  status: 'completed' | 'error' | 'not_connected';
  simulatedDuration: number;
  events: SimEvent[];
  deadlockReport?: DeadlockDetectedDetails;
  bankerState?: {
    available: number[];
    processes: BankerProcessSnapshot[];
    steps: BankerStepState[];
    safeSequence: number[];
    isSafe: boolean;
  };
  warnings?: string[];
  errorMessage?: string;
}

/**
 * Contiguous Memory Allocation Subsystem Contract (Phase 5 / docs/event-schema.md Section 2.2)
 */
export type AllocatorPolicy = 'FIRST_FIT' | 'BEST_FIT' | 'WORST_FIT';

export interface ContiguousBlock {
  id: number;
  start: number;
  size: number;
  allocated: boolean;
  owner?: number;
}

export interface AllocationSucceededDetails {
  bytes: number;
  start: number;
  blockId: number;
  policy: AllocatorPolicy;
}

export interface AllocationFailedDetails {
  bytes: number;
  totalFree: number;
  reason: 'external_fragmentation' | 'out_of_memory';
}

export interface ContiguousAllocationResult {
  success: boolean;
  blockId?: number;
  requested: number;
  allocated: number;
  externalFragmentation: number;
  reason: string;
}

export interface ContiguousAllocatorState {
  totalCapacity: number;
  totalFree: number;
  blocks: ContiguousBlock[];
  lastResult?: ContiguousAllocationResult;
}

/**
 * Disk Scheduling Subsystem Contract (Phase 5 / docs/event-schema.md Section 2.4)
 */
export interface DiskRequestServicedDetails {
  fromCylinder: number;
  toCylinder: number;
  distance: number;
  accumulatedSeek: number;
  policy: DiskPolicy;
  isWrapJump?: boolean;
}

/**
 * Web Worker Message Protocol Contracts (Phase 6 WASM / Worker Bridge)
 */
export type WorkerRequestType = 'RUN_SIMULATION' | 'PING' | 'GET_STATUS';
export type WorkerResponseType = 'SIMULATION_RESULT' | 'PONG' | 'STATUS' | 'ERROR';

export interface WorkerRequestMessage {
  type: WorkerRequestType;
  id: string;
  request?: SimulationRequest;
  timestamp?: number;
}

export interface WorkerStatus {
  isReady: boolean;
  wasmAvailable: boolean;
  activeRuns: number;
  toolchainStatus: string;
}

export interface WorkerResponseMessage {
  type: WorkerResponseType;
  id: string;
  response?: SimulationResponse;
  status?: WorkerStatus;
  latencyMs?: number;
  workerTimestamp?: number;
  error?: string;
}

/**
 * Replay State & Deterministic Checkpoint Contracts
 */
export type ProcessState = 'NEW' | 'READY' | 'RUNNING' | 'WAITING' | 'TERMINATED';

export interface ProcessRuntimeSnapshot {
  pid: number;
  state: ProcessState;
  currentBurstRemaining: number;
  totalCpuTime: number;
  totalWaitTime: number;
  lastStateChangeTick: number;
}

export interface ReplayEngineState {
  currentTick: number;
  runningPid: number | null;
  readyQueue: number[];
  waitingQueue: number[];
  terminatedPids: number[];
  processes: Record<number, ProcessRuntimeSnapshot>;
  metrics: {
    contextSwitches: number;
    cpuBusyTicks: number;
    totalTicks: number;
  };
  customSubsystemState?: Record<string, any>;
}

export interface ReplayCheckpoint {
  tick: number;
  eventIndex: number;
  state: ReplayEngineState;
}

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'completed';

export interface ReplayState {
  schemaVersion: number;
  status: PlaybackState;
  runId: string | null;
  events: SimEvent[];
  currentTick: number;
  maxTick: number;
  playbackSpeed: number;
  checkpoints: ReplayCheckpoint[];
  currentState: ReplayEngineState;
  activeEvents: SimEvent[];
  error: string | null;
  loading: boolean;
  workloadProcesses?: ProcessSpec[];
}

export type ReplayAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; payload: { response: SimulationResponse; processes?: ProcessSpec[] } }
  | { type: 'LOAD_ERROR'; payload: { error: string } }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TICK_FORWARD' }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACKWARD' }
  | { type: 'SCRUB_TO_TICK'; payload: { tick: number } }
  | { type: 'SET_SPEED'; payload: { speed: number } }
  | { type: 'RESET' };


