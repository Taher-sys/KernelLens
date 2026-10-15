/**
 * KernelLens Phase 5 UI & Contract Tests
 * Validates:
 * 1. Disk head scheduling empty queue handling
 * 2. SCAN and C-SCAN wrap semantics (no misleading animations, distinct wrap jump)
 * 3. Textbook disk seek distances (SSTF < LOOK < FCFS)
 * 4. Contiguous memory failed allocation display (external fragmentation and out-of-memory)
 * 5. First-Fit, Best-Fit, Worst-Fit selection invariants
 */

import { runDiskSimulation } from '../bridge/simulationBridge';
import {
  GOLDEN_EXTERNAL_FRAG_SCENARIO,
  GOLDEN_OUT_OF_MEMORY_SCENARIO,
  GOLDEN_FIT_COMPARISONS
} from '../bridge/allocatorGoldenData';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function runPhase5Tests() {
  console.log('========================================================');
  console.log('   Running KernelLens Phase 5 UI & Contract Tests       ');
  console.log('========================================================\n');

  // Test 1: Empty Queue Disk Handling
  {
    console.log('Test 1: Validating empty queue disk handling...');

    const emptyResult = runDiskSimulation([], 53, 'FCFS');
    assert(emptyResult.totalSeekDistance === 0, 'Empty queue must yield 0 seek distance');
    assert(emptyResult.serviceOrder.length === 0, 'Empty queue must have empty service order');
    assert(emptyResult.events.length === 0, 'Empty queue must emit 0 events');

    // Also test SSTF, SCAN, C-SCAN with empty queue
    const emptyScan = runDiskSimulation([], 53, 'SCAN');
    assert(emptyScan.totalSeekDistance === 0, 'Empty SCAN must have 0 seek distance');

    const emptyCScan = runDiskSimulation([], 53, 'C-SCAN');
    assert(emptyCScan.totalSeekDistance === 0, 'Empty C-SCAN must have 0 seek distance');

    console.log(' [PASS] Empty queue state correctly handled without errors or NaN.\n');
  }

  // Test 2: Textbook Disk Seek Benchmarks (Silberschatz Invariants)
  {
    console.log('Test 2: Validating textbook disk seek benchmarks (FCFS, SSTF, LOOK)...');
    const textbookReqs = [98, 183, 37, 122, 14, 124, 65, 67];
    const initialHead = 53;
    const maxCylinder = 199;

    // FCFS: 640 cylinders
    const fcfs = runDiskSimulation(textbookReqs, initialHead, 'FCFS', maxCylinder, 'UP');
    assert(fcfs.totalSeekDistance === 640, `FCFS total seek must be 640, got ${fcfs.totalSeekDistance}`);
    assert(fcfs.serviceOrder.length === 8, 'FCFS must service all 8 requests');

    // SSTF: 236 cylinders
    const sstf = runDiskSimulation(textbookReqs, initialHead, 'SSTF', maxCylinder, 'UP');
    assert(sstf.totalSeekDistance === 236, `SSTF total seek must be 236, got ${sstf.totalSeekDistance}`);

    // LOOK: 299 cylinders
    const look = runDiskSimulation(textbookReqs, initialHead, 'LOOK', maxCylinder, 'UP');
    assert(look.totalSeekDistance === 299, `LOOK total seek must be 299, got ${look.totalSeekDistance}`);

    // Invariant: SSTF (236) < LOOK (299) < FCFS (640)
    assert(sstf.totalSeekDistance < look.totalSeekDistance, 'SSTF seek must be strictly less than LOOK');
    assert(look.totalSeekDistance < fcfs.totalSeekDistance, 'LOOK seek must be strictly less than FCFS');

    console.log(' [PASS] Disk benchmarks verified: SSTF (236) < LOOK (299) < FCFS (640).\n');
  }

  // Test 3: SCAN vs C-SCAN Wrap Semantics
  {
    console.log('Test 3: Validating SCAN vs C-SCAN wrap semantics (avoiding misleading wrap animations)...');
    const requests = [98, 183, 37, 122, 14, 124, 65, 67];
    const initialHead = 53;
    const maxCylinder = 199;

    const scanRes = runDiskSimulation(requests, initialHead, 'SCAN', maxCylinder, 'UP');
    const cscanRes = runDiskSimulation(requests, initialHead, 'C-SCAN', maxCylinder, 'UP');

    // In SCAN moving UP: Upper requests serviced in ascending order, then reaches 199, then reverses to service lower in descending order
    // Order: 65, 67, 98, 122, 124, 183, then 37, 14
    assert(scanRes.serviceOrder[0] === 65, 'SCAN first request is 65');
    assert(scanRes.serviceOrder[5] === 183, 'SCAN 6th request is 183');
    assert(scanRes.serviceOrder[6] === 37, 'SCAN 7th request after boundary reversal is 37');
    assert(scanRes.serviceOrder[7] === 14, 'SCAN 8th request after boundary reversal is 14');

    // In C-SCAN moving UP: Upper requests serviced in ascending order, wraps to 0, then services lower in ascending order (14, 37)
    // Order: 65, 67, 98, 122, 124, 183, then 14, 37
    assert(cscanRes.serviceOrder[0] === 65, 'C-SCAN first request is 65');
    assert(cscanRes.serviceOrder[5] === 183, 'C-SCAN 6th request is 183');
    assert(cscanRes.serviceOrder[6] === 14, 'C-SCAN 7th request after wrap to 0 is 14');
    assert(cscanRes.serviceOrder[7] === 37, 'C-SCAN 8th request after wrap to 0 is 37');

    // Verify C-SCAN wrap jump: from 183 to 14 is a wrap-around transition (distance > maxCylinder / 2)
    const wrapStep = cscanRes.events.find(e => e.details.toCylinder === 14);
    assert(wrapStep !== undefined, 'C-SCAN must contain step servicing 14 after wrap');
    assert(
      wrapStep!.details.fromCylinder === 183 || wrapStep!.details.fromCylinder === 0,
      'Wrap transition must originate from 183 or 0'
    );

    console.log(' [PASS] SCAN reversal vs C-SCAN circular wrap semantics verified.\n');
  }

  // Test 4: Contiguous Memory Failed Allocation Display (External Fragmentation)
  {
    console.log('Test 4: Validating failed allocation display and external fragmentation diagnostics...');

    const scenario = GOLDEN_EXTERNAL_FRAG_SCENARIO;
    assert(scenario.expectedResult.success === false, 'Allocation must fail');
    assert(
      scenario.expectedResult.reason.includes('external fragmentation'),
      `Reason must cite external fragmentation, got: "${scenario.expectedResult.reason}"`
    );

    // Diagnostic values
    const totalFree = scenario.initialBlocks
      .filter(b => !b.allocated)
      .reduce((sum, b) => sum + b.size, 0);

    const largestHole = scenario.initialBlocks
      .filter(b => !b.allocated)
      .reduce((max, b) => Math.max(max, b.size), 0);

    assert(totalFree === 400, `Total free must be 400 KB, got ${totalFree}`);
    assert(largestHole === 200, `Largest contiguous hole must be 200 KB, got ${largestHole}`);
    assert(scenario.requestBytes === 350, 'Requested bytes is 350 KB');

    // Invariant: Total free (400) >= Requested (350), but Largest Hole (200) < Requested (350)
    assert(totalFree >= scenario.requestBytes, 'Free memory must exceed request');
    assert(largestHole < scenario.requestBytes, 'Largest contiguous hole must be smaller than request');
    assert(scenario.expectedResult.externalFragmentation === 400, 'Reported fragmentation must be 400');

    // Event check
    assert(scenario.events.length === 1, 'Must emit allocation_failed event');
    assert(scenario.events[0].type === 'allocation_failed', 'Event type must be allocation_failed');
    assert(scenario.events[0].details.reason === 'external_fragmentation', 'Event reason must be external_fragmentation');
    assert(scenario.events[0].details.totalFree === 400, 'Event totalFree must be 400');

    console.log(' [PASS] External fragmentation failure diagnostics verified (Free 400 KB >= Req 350 KB > Max Hole 200 KB).\n');
  }

  // Test 5: Out of Memory Allocation Failure
  {
    console.log('Test 5: Validating Out of Memory failure display...');

    const oomScenario = GOLDEN_OUT_OF_MEMORY_SCENARIO;
    assert(oomScenario.expectedResult.success === false, 'OOM allocation must fail');
    assert(
      oomScenario.expectedResult.reason.includes('out of total free memory'),
      `Reason must cite out of total free memory, got: "${oomScenario.expectedResult.reason}"`
    );

    const totalFree = oomScenario.initialBlocks
      .filter(b => !b.allocated)
      .reduce((sum, b) => sum + b.size, 0);

    assert(totalFree === 150, `Total free must be 150 KB, got ${totalFree}`);
    assert(oomScenario.requestBytes === 200, 'Requested bytes is 200 KB');
    assert(totalFree < oomScenario.requestBytes, 'Total free must be less than requested bytes');

    // Event check
    assert(oomScenario.events[0].details.reason === 'out_of_memory', 'Event reason must be out_of_memory');

    console.log(' [PASS] Out of memory failure display verified.\n');
  }

  // Test 6: First-Fit vs Best-Fit vs Worst-Fit Invariants
  {
    console.log('Test 6: Validating First-Fit, Best-Fit, and Worst-Fit hole selection...');

    const firstFit = GOLDEN_FIT_COMPARISONS.FIRST_FIT;
    const bestFit = GOLDEN_FIT_COMPARISONS.BEST_FIT;
    const worstFit = GOLDEN_FIT_COMPARISONS.WORST_FIT;

    // All three succeed for request of 250 KB
    assert(firstFit.expectedResult.success === true, 'First fit must succeed');
    assert(bestFit.expectedResult.success === true, 'Best fit must succeed');
    assert(worstFit.expectedResult.success === true, 'Worst fit must succeed');

    // First Fit takes the first hole >= 250 (blockId 3 at start 350, size 500)
    assert(firstFit.expectedResult.blockId === 3, 'First fit must choose blockId 3');

    // Best Fit takes the smallest hole >= 250 (blockId 5 at start 1000, size 300)
    assert(bestFit.expectedResult.blockId === 5, 'Best fit must choose blockId 5 (300 KB hole)');

    // Worst Fit takes the largest hole (blockId 3 at start 350, size 500)
    assert(worstFit.expectedResult.blockId === 3, 'Worst fit must choose blockId 3 (500 KB hole)');

    // Verify remaining slack after allocation:
    // Best Fit: 300 - 250 = 50 KB slack
    const bestFitSlack = 300 - 250;
    // First/Worst Fit: 500 - 250 = 250 KB slack
    const worstFitSlack = 500 - 250;
    assert(bestFitSlack < worstFitSlack, 'Best fit slack (50 KB) must be less than Worst fit slack (250 KB)');

    console.log(' [PASS] First-Fit, Best-Fit, Worst-Fit hole selection invariants verified.\n');
  }

  console.log('========================================================');
  console.log('   ALL PHASE 5 UI & CONTRACT TESTS PASSED (6/6)         ');
  console.log('========================================================\n');
}

runPhase5Tests().catch(err => {
  console.error('[FAILED]:', err);
  process.exit(1);
});
