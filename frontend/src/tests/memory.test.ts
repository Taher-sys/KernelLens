/**
 * KernelLens Memory Subsystem UI & Contract Tests
 * Tests empty data handling, explicit "engine not connected" state,
 * and real C++ engine event sequence reconstruction.
 * 
 * Strict rule: NEVER simulate page replacement in TypeScript.
 */

import { EngineBridge } from '../bridge/engineBridge';
import {
  GOLDEN_MEMORY_DATASETS,
  replayMemoryFramesAtTick,
  replayTlbAtTick
} from '../bridge/memoryGoldenData';
import { SimulationRequest } from '../bridge/schema';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function runMemoryTests() {
  console.log('========================================================');
  console.log('   Running KernelLens Memory UI & Contract Tests        ');
  console.log('========================================================\n');

  const bridge = new EngineBridge();

  // Test 1: Empty Data Handling
  {
    console.log('Test 1: Validating empty data and zero-capacity handling...');

    // Empty frames replay
    const emptyFrames = replayMemoryFramesAtTick([], 3, 0);
    assert(emptyFrames.frames.length === 3, 'Must allocate 3 frame slots');
    assert(emptyFrames.frames[0].page === null, 'Empty frame 0 must have null page');
    assert(emptyFrames.frames[1].page === null, 'Empty frame 1 must have null page');
    assert(emptyFrames.frames[2].page === null, 'Empty frame 2 must have null page');
    assert(emptyFrames.isFault === false, 'Empty events must not trigger page fault');
    assert(emptyFrames.lastEvicted === null, 'Empty events must have no eviction');

    // Empty TLB replay
    const emptyTlb = replayTlbAtTick([], 4, 0);
    assert(emptyTlb.entries.length === 0, 'Empty events must produce empty TLB entries');
    assert(emptyTlb.lastHit === null, 'Empty events must produce null lastHit');

    // Zero capacity TLB
    const zeroCapTlb = replayTlbAtTick([], 0, 0);
    assert(zeroCapTlb.entries.length === 0, 'Zero capacity TLB must remain empty');

    console.log(' [PASS] Empty data structures correctly handled without error.\n');
  }

  // Test 2: Explicit "engine not connected" state
  {
    console.log('Test 2: Validating explicit "engine not connected" state for un-cached workloads...');

    const uncachedRequest: SimulationRequest = {
      schemaVersion: 1,
      runId: 'mem-custom-unconnected',
      seed: 42,
      module: 'memory',
      policy: { name: 'FIFO' },
      workload: {
        references: [99, 88, 77, 66] // Custom reference string not in C++ golden cache
      },
      options: { numFrames: 3 }
    };

    const response = await bridge.run(uncachedRequest);
    assert(response.status === 'not_connected', 'Unconnected memory engine must return status "not_connected"');
    assert(response.errorMessage === 'engine not connected', 'Must include explicit "engine not connected" message');
    assert(response.events.length === 0, 'Must NOT generate fake TypeScript simulated events');

    console.log(' [PASS] "engine not connected" explicit state verified; no TypeScript simulation executed.\n');
  }

  // Test 3: Real C++ Engine Event Sequence: Belady FIFO 3 frames vs 4 frames
  {
    console.log('Test 3: Validating real C++ Belady Anomaly event sequence...');

    const belady3 = GOLDEN_MEMORY_DATASETS['FIFO-belady-3'];
    assert(belady3 !== undefined, 'FIFO-belady-3 dataset must exist');
    assert(belady3.metrics.pageFaults === 9, `3 frames must yield 9 page faults, got ${belady3.metrics.pageFaults}`);

    // Reconstruct frame state at tick 3 (P4 arrives, evicting P1 from Frame 0)
    const tick3State = replayMemoryFramesAtTick(belady3.events, 3, 3);
    assert(tick3State.isFault === true, 'Tick 3 must be a page fault');
    assert(tick3State.lastEvicted === 1, `Tick 3 must evict Page 1, got ${tick3State.lastEvicted}`);
    assert(tick3State.frames[0].page === 4, 'Frame 0 must now contain Page 4');

    // Reconstruct frame state at tick 7 (P1 hits in Frame 1)
    const tick7Tlb = replayTlbAtTick(belady3.events, 4, 7);
    assert(tick7Tlb.lastHit === true, 'Tick 7 must register a TLB hit');

    // Test Belady 4 frames
    const belady4 = GOLDEN_MEMORY_DATASETS['FIFO-belady-4'];
    assert(belady4 !== undefined, 'FIFO-belady-4 dataset must exist');
    assert(belady4.metrics.pageFaults === 10, `4 frames must yield 10 page faults, got ${belady4.metrics.pageFaults}`);

    // Verify Belady's Anomaly invariant from C++ engine: faults(4) > faults(3)
    assert(
      belady4.metrics.pageFaults > belady3.metrics.pageFaults,
      'Belady anomaly invariant violated: 4 frames must have more faults than 3 frames for FIFO'
    );

    console.log(' [PASS] C++ Belady Anomaly sequence verified (3 frames = 9 faults, 4 frames = 10 faults).\n');
  }

  // Test 4: Real C++ Engine Event Sequence: Textbook Comparison (FIFO vs LRU vs Optimal)
  {
    console.log('Test 4: Validating real C++ textbook comparison sequence (FIFO vs LRU vs Optimal)...');

    const fifoTextbook = GOLDEN_MEMORY_DATASETS['FIFO-textbook-3'];
    const lruTextbook = GOLDEN_MEMORY_DATASETS['LRU-textbook-3'];
    const optTextbook = GOLDEN_MEMORY_DATASETS['OPTIMAL-textbook-3'];

    assert(fifoTextbook.metrics.pageFaults === 15, `FIFO must have 15 faults, got ${fifoTextbook.metrics.pageFaults}`);
    assert(lruTextbook.metrics.pageFaults === 12, `LRU must have 12 faults, got ${lruTextbook.metrics.pageFaults}`);
    assert(optTextbook.metrics.pageFaults === 9, `Optimal must have 9 faults, got ${optTextbook.metrics.pageFaults}`);

    // Textbook Invariant: Optimal (9) <= LRU (12) <= FIFO (15)
    assert(
      optTextbook.metrics.pageFaults <= lruTextbook.metrics.pageFaults,
      'Optimal must have <= faults than LRU'
    );
    assert(
      lruTextbook.metrics.pageFaults <= fifoTextbook.metrics.pageFaults,
      'LRU must have <= faults than FIFO'
    );

    // Verify TLB Hits: Optimal (11) >= LRU (8) >= FIFO (5)
    assert(optTextbook.metrics.tlbHits === 11, 'Optimal must have 11 TLB hits');
    assert(lruTextbook.metrics.tlbHits === 8, 'LRU must have 8 TLB hits');
    assert(fifoTextbook.metrics.tlbHits === 5, 'FIFO must have 5 TLB hits');

    console.log(' [PASS] Textbook comparison sequence verified: Optimal (9) <= LRU (12) <= FIFO (15).\n');
  }

  // Test 5: Accessible Page Fault Marker Detection
  {
    console.log('Test 5: Verifying accessible page fault marker metadata...');

    const belady3Events = GOLDEN_MEMORY_DATASETS['FIFO-belady-3'].events;

    // Check all page fault events have required details
    const faultEvents = belady3Events.filter(e => e.type === 'page_fault');
    assert(faultEvents.length === 9, 'Must have exactly 9 page fault events');

    for (const fe of faultEvents) {
      assert(typeof fe.details.page === 'number', 'Page fault event must contain page number');
      assert(typeof fe.details.frame === 'number', 'Page fault event must contain target frame');
      assert(fe.subsystem === 'memory', 'Event subsystem must be "memory"');
    }

    // Check eviction events
    const evictionEvents = belady3Events.filter(e => e.type === 'frame_evicted');
    assert(evictionEvents.length === 6, 'Must have 6 frame eviction events');

    for (const ee of evictionEvents) {
      assert(typeof ee.details.frame === 'number', 'Eviction event must contain frame index');
      assert(typeof ee.details.evictedPage === 'number', 'Eviction event must contain evicted page number');
    }

    console.log(' [PASS] Page fault and eviction accessible metadata validated.\n');
  }

  console.log('========================================================');
  console.log('   ALL MEMORY UI & CONTRACT TESTS PASSED (5/5)          ');
  console.log('========================================================\n');
}

runMemoryTests().catch(err => {
  console.error('[FAILED]:', err);
  process.exit(1);
});
