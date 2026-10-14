export type Subsystem = 'cpu' | 'memory' | 'sync' | 'disk' | 'filesystem' | 'system';

export interface SimEvent {
  schemaVersion: number;
  runId: string;
  seq: number;
  time: number;
  subsystem: Subsystem;
  type: string;
  pid: number | null;
  details: Record<string, any>;
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

export interface SimulationResponse {
  schemaVersion: number;
  runId: string;
  status: 'completed' | 'error';
  simulatedDuration: number;
  events: SimEvent[];
  metrics: SimulationMetrics;
  warnings?: string[];
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

export type CpuPolicy = 'FCFS' | 'SJF' | 'SRTF' | 'PRIORITY' | 'ROUND_ROBIN' | 'MLFQ' | 'CFS_LIKE';
export type MemoryPolicy = 'FIFO' | 'LRU' | 'OPTIMAL' | 'CLOCK';
export type DiskPolicy = 'FCFS' | 'SSTF' | 'SCAN' | 'C-SCAN' | 'LOOK' | 'C-LOOK';
