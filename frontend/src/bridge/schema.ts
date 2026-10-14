/**
 * KernelLens Engine-to-UI Contract & Event Schema (schemaVersion: 1)
 * Defined in docs/event-schema.md and docs/architecture.md
 */

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

export interface SimulationOptions {
  quantum?: number;
  preemptive?: boolean;
  agingInterval?: number;
  contextSwitchCost?: number;
  emitDetailedEvents?: boolean;
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
    processes: ProcessSpec[];
    [key: string]: any;
  };
  options?: SimulationOptions;
}

export interface SimulationResponse {
  schemaVersion: number;
  runId: string;
  status: 'completed' | 'error';
  simulatedDuration: number;
  events: SimEvent[];
  metrics: SimulationMetrics;
  warnings?: string[];
}
