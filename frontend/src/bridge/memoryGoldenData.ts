/**
 * Canonical Memory Simulation Datasets directly generated from C++17 Engine
 * (kernellens CLI & tests/golden/test_golden_memory.cpp)
 * 
 * NEVER compute page replacement in TypeScript.
 */

import { SimEvent, MemoryMetrics } from './schema';

export interface GoldenMemoryDataset {
  runId: string;
  policy: 'FIFO' | 'LRU' | 'OPTIMAL' | 'CLOCK';
  numFrames: number;
  referenceString: number[];
  events: SimEvent[];
  metrics: MemoryMetrics;
}

export const GOLDEN_MEMORY_DATASETS: Record<string, GoldenMemoryDataset> = {
  'FIFO-belady-3': {
    runId: 'mem-FIFO-belady-3',
    policy: 'FIFO',
    numFrames: 3,
    referenceString: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5],
    metrics: {
      totalAccesses: 12,
      pageFaults: 9,
      tlbHits: 3,
      tlbMisses: 9,
      faultRate: 0.75,
      tlbHitRate: 0.25
    },
    events: [
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 0, time: 0, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 1, time: 0, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 1, frame: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 2, time: 0, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 1, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 3, time: 1, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 4, time: 1, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 2, frame: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 5, time: 1, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 2, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 6, time: 2, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 3 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 7, time: 2, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 3, frame: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 8, time: 2, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 3, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 9, time: 3, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 4 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 10, time: 3, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 11, time: 3, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 4, frame: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 12, time: 3, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 4, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 13, time: 4, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 14, time: 4, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 1, evictedPage: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 15, time: 4, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 1, frame: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 16, time: 4, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 1, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 17, time: 5, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 18, time: 5, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 2, evictedPage: 3, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 19, time: 5, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 2, frame: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 20, time: 5, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 2, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 21, time: 6, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 5 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 22, time: 6, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 4, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 23, time: 6, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 5, frame: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 24, time: 6, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 5, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 25, time: 7, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 1, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 26, time: 8, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 2, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 27, time: 9, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 3 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 28, time: 9, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 1, evictedPage: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 29, time: 9, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 3, frame: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 30, time: 9, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 3, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 31, time: 10, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 4 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 32, time: 10, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 2, evictedPage: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 33, time: 10, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 4, frame: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 34, time: 10, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 4, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 35, time: 11, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 5, frame: 0 } }
    ]
  },

  'FIFO-belady-4': {
    runId: 'mem-FIFO-belady-4',
    policy: 'FIFO',
    numFrames: 4,
    referenceString: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5],
    metrics: {
      totalAccesses: 12,
      pageFaults: 10,
      tlbHits: 2,
      tlbMisses: 10,
      faultRate: 0.8333,
      tlbHitRate: 0.1667
    },
    events: [
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 0, time: 0, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 1, time: 0, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 1, frame: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 2, time: 0, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 1, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 3, time: 1, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 4, time: 1, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 2, frame: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 5, time: 1, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 2, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 6, time: 2, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 3 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 7, time: 2, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 3, frame: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 8, time: 2, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 3, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 9, time: 3, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 4 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 10, time: 3, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 4, frame: 3, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 11, time: 3, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 4, frame: 3 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 12, time: 4, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 1, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 13, time: 5, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 2, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 14, time: 6, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 5 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 15, time: 6, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 16, time: 6, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 5, frame: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 17, time: 6, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 5, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 18, time: 7, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 19, time: 7, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 1, evictedPage: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 20, time: 7, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 1, frame: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 21, time: 7, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 1, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 22, time: 8, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 23, time: 8, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 2, evictedPage: 3, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 24, time: 8, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 2, frame: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 25, time: 8, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 2, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 26, time: 9, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 3 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 27, time: 9, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 3, evictedPage: 4, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 28, time: 9, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 3, frame: 3, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 29, time: 9, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 3, frame: 3 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 30, time: 10, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 4 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 31, time: 10, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 5, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 32, time: 10, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 4, frame: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 33, time: 10, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 4, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 34, time: 11, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 5 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 35, time: 11, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 1, evictedPage: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 36, time: 11, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 5, frame: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 37, time: 11, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 5, frame: 1 } }
    ]
  },

  'FIFO-textbook-3': {
    runId: 'mem-FIFO-textbook-3',
    policy: 'FIFO',
    numFrames: 3,
    referenceString: [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1],
    metrics: {
      totalAccesses: 20,
      pageFaults: 15,
      tlbHits: 5,
      tlbMisses: 15,
      faultRate: 0.75,
      tlbHitRate: 0.25
    },
    events: [
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 0, time: 0, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 7 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 1, time: 0, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 7, frame: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 2, time: 0, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 7, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 3, time: 1, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 4, time: 1, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 0, frame: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 5, time: 1, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 6, time: 2, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 7, time: 2, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 1, frame: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 8, time: 2, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 1, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 9, time: 3, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 10, time: 3, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 7, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 11, time: 3, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 2, frame: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 12, time: 3, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 2, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 13, time: 4, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 14, time: 5, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 3 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 15, time: 5, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 1, evictedPage: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 16, time: 5, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 3, frame: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 17, time: 5, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 3, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 18, time: 6, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 19, time: 6, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 2, evictedPage: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 20, time: 6, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 0, frame: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 21, time: 6, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 0, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 22, time: 7, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 4 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 23, time: 7, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 24, time: 7, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 4, frame: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 25, time: 7, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 4, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 26, time: 8, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 27, time: 8, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 1, evictedPage: 3, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 28, time: 8, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 2, frame: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 29, time: 8, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 2, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 30, time: 9, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 3 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 31, time: 9, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 2, evictedPage: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 32, time: 9, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 3, frame: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 33, time: 9, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 3, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 34, time: 10, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 35, time: 10, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 4, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 36, time: 10, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 0, frame: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 37, time: 10, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 0, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 38, time: 11, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 3, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 39, time: 12, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 2, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 40, time: 13, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 41, time: 13, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 1, evictedPage: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 42, time: 13, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 1, frame: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 43, time: 13, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 1, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 44, time: 14, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 45, time: 14, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 2, evictedPage: 3, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 46, time: 14, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 2, frame: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 47, time: 14, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 2, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 48, time: 15, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 0, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 49, time: 16, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 1, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 50, time: 17, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 7 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 51, time: 17, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 52, time: 17, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 7, frame: 0, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 53, time: 17, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 7, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 54, time: 18, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 0 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 55, time: 18, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 1, evictedPage: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 56, time: 18, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 0, frame: 1, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 57, time: 18, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 58, time: 19, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 1 } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 59, time: 19, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 2, evictedPage: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 60, time: 19, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 1, frame: 2, policy: 'FIFO' } },
      { schemaVersion: 1, runId: 'mem-FIFO', seq: 61, time: 19, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 1, frame: 2 } }
    ]
  },

  'LRU-textbook-3': {
    runId: 'mem-LRU-textbook-3',
    policy: 'LRU',
    numFrames: 3,
    referenceString: [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1],
    metrics: {
      totalAccesses: 20,
      pageFaults: 12,
      tlbHits: 8,
      tlbMisses: 12,
      faultRate: 0.6,
      tlbHitRate: 0.4
    },
    events: [
      { schemaVersion: 1, runId: 'mem-LRU', seq: 0, time: 0, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 7 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 1, time: 0, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 7, frame: 0, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 2, time: 0, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 7, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 3, time: 1, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 0 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 4, time: 1, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 0, frame: 1, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 5, time: 1, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 6, time: 2, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 1 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 7, time: 2, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 1, frame: 2, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 8, time: 2, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 1, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 9, time: 3, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 2 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 10, time: 3, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 7, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 11, time: 3, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 2, frame: 0, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 12, time: 3, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 2, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 13, time: 4, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 14, time: 5, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 3 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 15, time: 5, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 2, evictedPage: 1, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 16, time: 5, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 3, frame: 2, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 17, time: 5, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 3, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 18, time: 6, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 19, time: 7, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 4 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 20, time: 7, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 2, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 21, time: 7, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 4, frame: 0, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 22, time: 7, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 4, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 23, time: 8, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 2 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 24, time: 8, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 2, evictedPage: 3, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 25, time: 8, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 2, frame: 2, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 26, time: 8, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 2, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 27, time: 9, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 3 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 28, time: 9, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 1, evictedPage: 0, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 29, time: 9, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 3, frame: 1, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 30, time: 9, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 3, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 31, time: 10, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 0 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 32, time: 10, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 4, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 33, time: 10, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 0, frame: 0, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 34, time: 10, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 0, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 35, time: 11, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 3, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 36, time: 12, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 2, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 37, time: 13, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 1 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 38, time: 13, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 0, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 39, time: 13, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 1, frame: 0, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 40, time: 13, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 1, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 41, time: 14, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 2, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 42, time: 15, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 0 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 43, time: 15, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 1, evictedPage: 3, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 44, time: 15, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 0, frame: 1, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 45, time: 15, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 46, time: 16, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 1, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 47, time: 17, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 7 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 48, time: 17, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 2, evictedPage: 2, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 49, time: 17, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 7, frame: 2, policy: 'LRU' } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 50, time: 17, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 7, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 51, time: 18, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-LRU', seq: 52, time: 19, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 1, frame: 0 } }
    ]
  },

  'OPTIMAL-textbook-3': {
    runId: 'mem-OPTIMAL-textbook-3',
    policy: 'OPTIMAL',
    numFrames: 3,
    referenceString: [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1],
    metrics: {
      totalAccesses: 20,
      pageFaults: 9,
      tlbHits: 11,
      tlbMisses: 9,
      faultRate: 0.45,
      tlbHitRate: 0.55
    },
    events: [
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 0, time: 0, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 7 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 1, time: 0, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 7, frame: 0, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 2, time: 0, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 7, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 3, time: 1, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 0 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 4, time: 1, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 0, frame: 1, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 5, time: 1, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 6, time: 2, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 1 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 7, time: 2, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 1, frame: 2, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 8, time: 2, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 1, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 9, time: 3, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 2 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 10, time: 3, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 7, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 11, time: 3, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 2, frame: 0, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 12, time: 3, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 2, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 13, time: 4, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 14, time: 5, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 3 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 15, time: 5, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 2, evictedPage: 1, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 16, time: 5, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 3, frame: 2, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 17, time: 5, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 3, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 18, time: 6, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 19, time: 7, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 4 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 20, time: 7, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 1, evictedPage: 0, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 21, time: 7, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 4, frame: 1, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 22, time: 7, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 4, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 23, time: 8, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 2, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 24, time: 9, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 3, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 25, time: 10, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 0 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 26, time: 10, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 1, evictedPage: 4, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 27, time: 10, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 0, frame: 1, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 28, time: 10, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 29, time: 11, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 3, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 30, time: 12, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 2, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 31, time: 13, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 1 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 32, time: 13, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 2, evictedPage: 3, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 33, time: 13, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 1, frame: 2, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 34, time: 13, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 1, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 35, time: 14, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 2, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 36, time: 15, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 37, time: 16, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 1, frame: 2 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 38, time: 17, subsystem: 'memory', type: 'tlb_miss', pid: null, details: { page: 7 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 39, time: 17, subsystem: 'memory', type: 'frame_evicted', pid: null, details: { frame: 0, evictedPage: 2, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 40, time: 17, subsystem: 'memory', type: 'page_fault', pid: null, details: { page: 7, frame: 0, policy: 'OPTIMAL' } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 41, time: 17, subsystem: 'memory', type: 'frame_loaded', pid: null, details: { page: 7, frame: 0 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 42, time: 18, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 0, frame: 1 } },
      { schemaVersion: 1, runId: 'mem-OPTIMAL', seq: 43, time: 19, subsystem: 'memory', type: 'tlb_hit', pid: null, details: { page: 1, frame: 2 } }
    ]
  }
};

/**
 * Reconstruct physical memory frame states at any simulation tick from C++ engine event stream.
 * Pure event replay consumer — NEVER computes replacement decisions.
 */
export function replayMemoryFramesAtTick(
  events: SimEvent[],
  numFrames: number,
  targetTick: number
): { frames: Array<{ frameId: number; page: number | null; loadedAt: number; lastUsedAt: number; referenceBit: boolean; isVictim: boolean; isHit: boolean }>; lastEvicted: number | null; isFault: boolean } {
  const frames = Array.from({ length: numFrames }, (_, i) => ({
    frameId: i,
    page: null as number | null,
    loadedAt: 0,
    lastUsedAt: 0,
    referenceBit: false,
    isVictim: false,
    isHit: false
  }));

  let lastEvicted: number | null = null;
  let isFault = false;

  // Filter events up to targetTick
  const activeEvents = events.filter(e => e.time <= targetTick);

  for (const evt of activeEvents) {
    if (evt.subsystem !== 'memory') continue;

    if (evt.type === 'page_fault' && evt.time === targetTick) {
      isFault = true;
    }

    if (evt.type === 'frame_evicted' && evt.details) {
      const fIdx = evt.details.frame;
      if (fIdx !== undefined && frames[fIdx]) {
        frames[fIdx].isVictim = (evt.time === targetTick);
        if (evt.time === targetTick) {
          lastEvicted = evt.details.evictedPage;
        }
      }
    }

    if (evt.type === 'frame_loaded' && evt.details) {
      const fIdx = evt.details.frame;
      const pg = evt.details.page;
      if (fIdx !== undefined && frames[fIdx]) {
        frames[fIdx].page = pg;
        frames[fIdx].loadedAt = evt.time;
        frames[fIdx].lastUsedAt = evt.time;
        frames[fIdx].referenceBit = true;
        frames[fIdx].isHit = false;
      }
    }

    if ((evt.type === 'tlb_hit' || evt.type === 'page_access') && evt.details) {
      const fIdx = evt.details.frame;
      if (fIdx !== undefined && frames[fIdx]) {
        frames[fIdx].lastUsedAt = evt.time;
        frames[fIdx].referenceBit = true;
        if (evt.time === targetTick) {
          frames[fIdx].isHit = true;
        }
      }
    }
  }

  return { frames, lastEvicted, isFault };
}

/**
 * Reconstruct TLB entries at any simulation tick from C++ engine event stream.
 */
export function replayTlbAtTick(
  events: SimEvent[],
  capacity: number,
  targetTick: number
): { entries: Array<{ page: number; frame: number; lastAccess: number }>; lastHit: boolean | null } {
  const entries: Array<{ page: number; frame: number; lastAccess: number }> = [];
  let lastHit: boolean | null = null;

  const activeEvents = events.filter(e => e.time <= targetTick);

  for (const evt of activeEvents) {
    if (evt.subsystem !== 'memory') continue;

    if (evt.time === targetTick) {
      if (evt.type === 'tlb_hit') lastHit = true;
      if (evt.type === 'tlb_miss') lastHit = false;
    }

    if (evt.type === 'frame_evicted' && evt.details && evt.details.evictedPage !== undefined) {
      const idx = entries.findIndex(e => e.page === evt.details.evictedPage);
      if (idx !== -1) {
        entries.splice(idx, 1);
      }
    }

    if ((evt.type === 'tlb_hit' || evt.type === 'frame_loaded' || evt.type === 'page_access') && evt.details) {
      const pg = evt.details.page;
      const fr = evt.details.frame;
      if (pg !== undefined && fr !== undefined) {
        const existingIdx = entries.findIndex(e => e.page === pg);
        if (existingIdx !== -1) {
          entries[existingIdx].frame = fr;
          entries[existingIdx].lastAccess = evt.time;
        } else {
          if (entries.length >= capacity && capacity > 0) {
            // Evict least recently accessed in replay
            entries.sort((a, b) => a.lastAccess - b.lastAccess);
            entries.shift();
          }
          if (capacity > 0) {
            entries.push({ page: pg, frame: fr, lastAccess: evt.time });
          }
        }
      }
    }
  }

  return { entries, lastHit };
}
