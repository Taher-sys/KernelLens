/**
 * KernelLens Contiguous Memory Allocator Golden Datasets & Engine Helpers
 * Reflects the exact semantics of C++ ContiguousAllocator (engine/src/memory/allocator.cpp)
 * 
 * Strict rule: All results, metrics, and events originate from the C++ engine contract.
 */

import {
  ContiguousBlock,
  ContiguousAllocationResult,
  AllocatorPolicy,
  SimEvent
} from './schema';

export interface AllocatorScenario {
  id: string;
  name: string;
  description: string;
  policy: AllocatorPolicy;
  totalCapacity: number;
  initialBlocks: ContiguousBlock[];
  requestBytes: number;
  requestPid: number;
  expectedResult: ContiguousAllocationResult;
  resultBlocks: ContiguousBlock[];
  events: SimEvent[];
}

/**
 * Scenario 1: External Fragmentation Failure
 * Total free is 400 KB (two 200 KB holes), but request is 350 KB.
 * Allocation fails with explicit external fragmentation report.
 */
export const GOLDEN_EXTERNAL_FRAG_SCENARIO: AllocatorScenario = {
  id: 'external-frag',
  name: 'External Fragmentation Failure (C++ Benchmark)',
  description: 'Total free memory is 400 KB, but fragmented into two 200 KB blocks. Allocating 350 KB fails.',
  policy: 'FIRST_FIT',
  totalCapacity: 1000,
  initialBlocks: [
    { id: 1, start: 0, size: 300, allocated: true, owner: 1 },
    { id: 2, start: 300, size: 200, allocated: false },
    { id: 3, start: 500, size: 300, allocated: true, owner: 3 },
    { id: 4, start: 800, size: 200, allocated: false }
  ],
  requestBytes: 350,
  requestPid: 5,
  expectedResult: {
    success: false,
    requested: 350,
    allocated: 0,
    externalFragmentation: 400,
    reason: 'Allocation failed due to external fragmentation (insufficient contiguous space)'
  },
  resultBlocks: [
    { id: 1, start: 0, size: 300, allocated: true, owner: 1 },
    { id: 2, start: 300, size: 200, allocated: false },
    { id: 3, start: 500, size: 300, allocated: true, owner: 3 },
    { id: 4, start: 800, size: 200, allocated: false }
  ],
  events: [
    {
      schemaVersion: 1,
      runId: 'alloc-external-frag',
      seq: 0,
      time: 1,
      subsystem: 'memory',
      type: 'allocation_failed',
      pid: 5,
      details: {
        bytes: 350,
        totalFree: 400,
        reason: 'external_fragmentation'
      }
    }
  ]
};

/**
 * Scenario 2: Out of Memory (Total Free < Requested)
 */
export const GOLDEN_OUT_OF_MEMORY_SCENARIO: AllocatorScenario = {
  id: 'out-of-memory',
  name: 'Out of Memory Failure',
  description: 'Total capacity is 1000 KB, 850 KB is allocated. Request of 200 KB exceeds total free memory (150 KB).',
  policy: 'FIRST_FIT',
  totalCapacity: 1000,
  initialBlocks: [
    { id: 1, start: 0, size: 500, allocated: true, owner: 1 },
    { id: 2, start: 500, size: 150, allocated: false },
    { id: 3, start: 650, size: 350, allocated: true, owner: 2 }
  ],
  requestBytes: 200,
  requestPid: 4,
  expectedResult: {
    success: false,
    requested: 200,
    allocated: 0,
    externalFragmentation: 150,
    reason: 'Allocation failed (out of total free memory)'
  },
  resultBlocks: [
    { id: 1, start: 0, size: 500, allocated: true, owner: 1 },
    { id: 2, start: 500, size: 150, allocated: false },
    { id: 3, start: 650, size: 350, allocated: true, owner: 2 }
  ],
  events: [
    {
      schemaVersion: 1,
      runId: 'alloc-oom',
      seq: 0,
      time: 1,
      subsystem: 'memory',
      type: 'allocation_failed',
      pid: 4,
      details: {
        bytes: 200,
        totalFree: 150,
        reason: 'out_of_memory'
      }
    }
  ]
};

/**
 * Scenario 3: First Fit vs Best Fit vs Worst Fit Comparison
 * Initial holes: 200 KB, 500 KB, 300 KB.
 * Request: 250 KB for P4.
 */
export const GOLDEN_FIT_COMPARISONS: Record<AllocatorPolicy, AllocatorScenario> = {
  FIRST_FIT: {
    id: 'compare-first-fit',
    name: 'First Fit Allocation',
    description: 'Scans from start. First hole >= 250 KB is the 500 KB block. Splits into 250 KB allocated and 250 KB remainder.',
    policy: 'FIRST_FIT',
    totalCapacity: 1300,
    initialBlocks: [
      { id: 1, start: 0, size: 200, allocated: false },
      { id: 2, start: 200, size: 150, allocated: true, owner: 1 },
      { id: 3, start: 350, size: 500, allocated: false },
      { id: 4, start: 850, size: 150, allocated: true, owner: 2 },
      { id: 5, start: 1000, size: 300, allocated: false }
    ],
    requestBytes: 250,
    requestPid: 4,
    expectedResult: {
      success: true,
      blockId: 3,
      requested: 250,
      allocated: 250,
      externalFragmentation: 0,
      reason: 'Allocated successfully'
    },
    resultBlocks: [
      { id: 1, start: 0, size: 200, allocated: false },
      { id: 2, start: 200, size: 150, allocated: true, owner: 1 },
      { id: 3, start: 350, size: 250, allocated: true, owner: 4 },
      { id: 6, start: 600, size: 250, allocated: false },
      { id: 4, start: 850, size: 150, allocated: true, owner: 2 },
      { id: 5, start: 1000, size: 300, allocated: false }
    ],
    events: [
      {
        schemaVersion: 1,
        runId: 'alloc-first-fit',
        seq: 0,
        time: 1,
        subsystem: 'memory',
        type: 'allocation_succeeded',
        pid: 4,
        details: { bytes: 250, start: 350, blockId: 3, policy: 'FIRST_FIT' }
      }
    ]
  },

  BEST_FIT: {
    id: 'compare-best-fit',
    name: 'Best Fit Allocation',
    description: 'Finds smallest hole >= 250 KB (the 300 KB block). Leaves remaining slack of 50 KB and preserves large 500 KB hole.',
    policy: 'BEST_FIT',
    totalCapacity: 1300,
    initialBlocks: [
      { id: 1, start: 0, size: 200, allocated: false },
      { id: 2, start: 200, size: 150, allocated: true, owner: 1 },
      { id: 3, start: 350, size: 500, allocated: false },
      { id: 4, start: 850, size: 150, allocated: true, owner: 2 },
      { id: 5, start: 1000, size: 300, allocated: false }
    ],
    requestBytes: 250,
    requestPid: 4,
    expectedResult: {
      success: true,
      blockId: 5,
      requested: 250,
      allocated: 250,
      externalFragmentation: 0,
      reason: 'Allocated successfully'
    },
    resultBlocks: [
      { id: 1, start: 0, size: 200, allocated: false },
      { id: 2, start: 200, size: 150, allocated: true, owner: 1 },
      { id: 3, start: 350, size: 500, allocated: false },
      { id: 4, start: 850, size: 150, allocated: true, owner: 2 },
      { id: 5, start: 1000, size: 250, allocated: true, owner: 4 },
      { id: 6, start: 1250, size: 50, allocated: false }
    ],
    events: [
      {
        schemaVersion: 1,
        runId: 'alloc-best-fit',
        seq: 0,
        time: 1,
        subsystem: 'memory',
        type: 'allocation_succeeded',
        pid: 4,
        details: { bytes: 250, start: 1000, blockId: 5, policy: 'BEST_FIT' }
      }
    ]
  },

  WORST_FIT: {
    id: 'compare-worst-fit',
    name: 'Worst Fit Allocation',
    description: 'Finds largest hole (500 KB). Splits into 250 KB allocated and 250 KB remainder, leaving largest possible leftover.',
    policy: 'WORST_FIT',
    totalCapacity: 1300,
    initialBlocks: [
      { id: 1, start: 0, size: 200, allocated: false },
      { id: 2, start: 200, size: 150, allocated: true, owner: 1 },
      { id: 3, start: 350, size: 500, allocated: false },
      { id: 4, start: 850, size: 150, allocated: true, owner: 2 },
      { id: 5, start: 1000, size: 300, allocated: false }
    ],
    requestBytes: 250,
    requestPid: 4,
    expectedResult: {
      success: true,
      blockId: 3,
      requested: 250,
      allocated: 250,
      externalFragmentation: 0,
      reason: 'Allocated successfully'
    },
    resultBlocks: [
      { id: 1, start: 0, size: 200, allocated: false },
      { id: 2, start: 200, size: 150, allocated: true, owner: 1 },
      { id: 3, start: 350, size: 250, allocated: true, owner: 4 },
      { id: 6, start: 600, size: 250, allocated: false },
      { id: 4, start: 850, size: 150, allocated: true, owner: 2 },
      { id: 5, start: 1000, size: 300, allocated: false }
    ],
    events: [
      {
        schemaVersion: 1,
        runId: 'alloc-worst-fit',
        seq: 0,
        time: 1,
        subsystem: 'memory',
        type: 'allocation_succeeded',
        pid: 4,
        details: { bytes: 250, start: 350, blockId: 3, policy: 'WORST_FIT' }
      }
    ]
  }
};
