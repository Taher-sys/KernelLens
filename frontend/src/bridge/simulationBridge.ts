import {
  SimEvent,
  ProcessSpec,
  SimulationResponse,
  CpuPolicy,
  MemoryPolicy,
  DiskPolicy
} from '../types/schema';

// -------------------------------------------------------------
// CPU Simulation Engine (TypeScript Bridge matching C++ Engine)
// -------------------------------------------------------------
export function runCpuSimulation(
  workload: ProcessSpec[],
  policy: CpuPolicy,
  options: {
    quantum?: number;
    preemptive?: boolean;
    agingInterval?: number;
    contextSwitchCost?: number;
  } = {}
): SimulationResponse {
  const quantum = options.quantum ?? 3;
  const preemptive = options.preemptive ?? false;
  const agingInterval = options.agingInterval ?? 0;
  const switchCost = options.contextSwitchCost ?? 0;

  const events: SimEvent[] = [];
  let seq = 0;
  const runId = `cpu-${policy.toLowerCase()}`;

  function emit(time: number, type: string, pid: number | null, details: Record<string, any>) {
    events.push({
      schemaVersion: 1,
      runId,
      seq: seq++,
      time,
      subsystem: 'cpu',
      type,
      pid,
      details
    });
  }

  interface ProcessRuntime {
    spec: ProcessSpec;
    state: 'NEW' | 'READY' | 'RUNNING' | 'WAITING' | 'TERMINATED';
    burstIndex: number;
    remainingBurst: number;
    firstRunTime: number;
    finishTime: number;
    cpuService: number;
    readyWait: number;
    lastReadyTime: number;
    vruntime: number;
    mlfqLevel: number;
  }

  const procs: ProcessRuntime[] = workload.map(sp => ({
    spec: sp,
    state: 'NEW',
    burstIndex: 0,
    remainingBurst: sp.bursts.length > 0 ? sp.bursts[0].duration : 0,
    firstRunTime: -1,
    finishTime: -1,
    cpuService: 0,
    readyWait: 0,
    lastReadyTime: -1,
    vruntime: 0.0,
    mlfqLevel: 0
  }));

  let currentTick = 0;
  let runningPid: number | null = null;
  const readyQueue: number[] = [];
  let contextSwitches = 0;

  // MLFQ queues
  const mlfqQuanta = [quantum, quantum * 2, quantum * 4];
  const mlfqQueues: number[][] = [[], [], []];

  // Map of event callbacks: time -> list of actions
  interface EventItem {
    time: number;
    priority: number; // 0 high, 1 normal, 2 low
    seq: number;
    action: () => void;
  }
  const eventQueue: EventItem[] = [];
  let eventSeq = 0;

  function schedule(time: number, priority: number, action: () => void) {
    eventQueue.push({ time, priority, seq: eventSeq++, action });
    eventQueue.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.seq - b.seq;
    });
  }

  function getEffectivePriority(pr: ProcessRuntime, now: number): number {
    let p = pr.spec.basePriority;
    if (agingInterval > 0 && pr.lastReadyTime >= 0 && now > pr.lastReadyTime) {
      const boost = Math.floor((now - pr.lastReadyTime) / agingInterval);
      p -= boost;
    }
    return p;
  }

  function selectNextPid(): number | null {
    if (policy === 'FCFS') {
      return readyQueue.shift() ?? null;
    } else if (policy === 'ROUND_ROBIN') {
      return readyQueue.shift() ?? null;
    } else if (policy === 'SJF') {
      if (readyQueue.length === 0) return null;
      readyQueue.sort((a, b) => {
        const pa = procs.find(p => p.spec.pid === a)!;
        const pb = procs.find(p => p.spec.pid === b)!;
        if (pa.remainingBurst !== pb.remainingBurst) return pa.remainingBurst - pb.remainingBurst;
        if (pa.spec.arrivalTime !== pb.spec.arrivalTime) return pa.spec.arrivalTime - pb.spec.arrivalTime;
        return a - b;
      });
      return readyQueue.shift() ?? null;
    } else if (policy === 'SRTF') {
      if (readyQueue.length === 0) return null;
      readyQueue.sort((a, b) => {
        const pa = procs.find(p => p.spec.pid === a)!;
        const pb = procs.find(p => p.spec.pid === b)!;
        if (pa.remainingBurst !== pb.remainingBurst) return pa.remainingBurst - pb.remainingBurst;
        if (pa.spec.arrivalTime !== pb.spec.arrivalTime) return pa.spec.arrivalTime - pb.spec.arrivalTime;
        return a - b;
      });
      return readyQueue.shift() ?? null;
    } else if (policy === 'PRIORITY') {
      if (readyQueue.length === 0) return null;
      readyQueue.sort((a, b) => {
        const pa = procs.find(p => p.spec.pid === a)!;
        const pb = procs.find(p => p.spec.pid === b)!;
        const prioA = getEffectivePriority(pa, currentTick);
        const prioB = getEffectivePriority(pb, currentTick);
        if (prioA !== prioB) return prioA - prioB;
        if (pa.spec.arrivalTime !== pb.spec.arrivalTime) return pa.spec.arrivalTime - pb.spec.arrivalTime;
        return a - b;
      });
      return readyQueue.shift() ?? null;
    } else if (policy === 'MLFQ') {
      for (const q of mlfqQueues) {
        if (q.length > 0) return q.shift()!;
      }
      return null;
    } else if (policy === 'CFS_LIKE') {
      if (readyQueue.length === 0) return null;
      readyQueue.sort((a, b) => {
        const pa = procs.find(p => p.spec.pid === a)!;
        const pb = procs.find(p => p.spec.pid === b)!;
        if (Math.abs(pa.vruntime - pb.vruntime) > 1e-6) return pa.vruntime - pb.vruntime;
        return pa.spec.arrivalTime - pb.spec.arrivalTime;
      });
      return readyQueue.shift() ?? null;
    }
    return readyQueue.shift() ?? null;
  }

  function shouldPreempt(now: number): boolean {
    if (runningPid === null) return false;
    const cur = procs.find(p => p.spec.pid === runningPid)!;

    if (policy === 'SRTF') {
      return readyQueue.some(pid => {
        const pr = procs.find(p => p.spec.pid === pid)!;
        return pr.remainingBurst < cur.remainingBurst;
      });
    } else if (policy === 'PRIORITY' && preemptive) {
      const curPrio = getEffectivePriority(cur, now);
      return readyQueue.some(pid => {
        const pr = procs.find(p => p.spec.pid === pid)!;
        return getEffectivePriority(pr, now) < curPrio;
      });
    } else if (policy === 'MLFQ') {
      for (let lvl = 0; lvl < cur.mlfqLevel; ++lvl) {
        if (mlfqQueues[lvl].length > 0) return true;
      }
    }
    return false;
  }

  function trySchedule() {
    if (runningPid !== null) return;
    const nextPid = selectNextPid();
    if (nextPid === null) return;

    const pr = procs.find(p => p.spec.pid === nextPid)!;
    contextSwitches++;
    const dispatchTime = currentTick + switchCost;

    if (pr.lastReadyTime >= 0) {
      pr.readyWait += (currentTick - pr.lastReadyTime);
    }
    if (pr.firstRunTime < 0) {
      pr.firstRunTime = dispatchTime;
    }

    pr.state = 'RUNNING';
    runningPid = nextPid;

    let slice: number | null = null;
    if (policy === 'ROUND_ROBIN') {
      slice = quantum;
    } else if (policy === 'MLFQ') {
      slice = mlfqQuanta[pr.mlfqLevel] ?? mlfqQuanta[mlfqQuanta.length - 1];
    } else if (policy === 'CFS_LIKE') {
      slice = Math.max(1, Math.floor(6 / (readyQueue.length + 1)));
    }

    emit(dispatchTime, 'dispatch', nextPid, {
      policy,
      remainingBurst: pr.remainingBurst,
      quantum: slice
    });

    const burstRem = pr.remainingBurst;
    if (slice !== null && slice < burstRem) {
      schedule(dispatchTime + slice, 2, () => {
        if (runningPid !== nextPid) return;
        pr.remainingBurst -= slice!;
        pr.cpuService += slice!;
        pr.state = 'READY';
        pr.lastReadyTime = currentTick;

        if (policy === 'MLFQ') {
          pr.mlfqLevel = Math.min(pr.mlfqLevel + 1, mlfqQueues.length - 1);
          mlfqQueues[pr.mlfqLevel].push(nextPid);
        } else if (policy === 'CFS_LIKE') {
          pr.vruntime += slice! * (1024.0 / 1024.0);
          readyQueue.push(nextPid);
        } else {
          readyQueue.push(nextPid);
        }

        emit(currentTick, 'quantum_expired', nextPid, {
          quantum: slice,
          remainingBurst: pr.remainingBurst
        });
        runningPid = null;
        trySchedule();
      });
    } else {
      schedule(dispatchTime + burstRem, 2, () => {
        if (runningPid !== nextPid) return;
        pr.cpuService += burstRem;
        pr.remainingBurst = 0;
        runningPid = null;

        emit(currentTick, 'cpu_burst_completed', nextPid, { completedBurstIndex: pr.burstIndex });
        pr.burstIndex++;

        if (pr.burstIndex < pr.spec.bursts.length) {
          const nextBurst = pr.spec.bursts[pr.burstIndex];
          if (nextBurst.kind === 'IO') {
            pr.state = 'WAITING';
            emit(currentTick, 'io_started', nextPid, { ioDuration: nextBurst.duration });
            schedule(currentTick + nextBurst.duration, 0, () => {
              emit(currentTick, 'io_completed', nextPid, {});
              pr.burstIndex++;
              if (pr.burstIndex < pr.spec.bursts.length) {
                pr.remainingBurst = pr.spec.bursts[pr.burstIndex].duration;
                pr.state = 'READY';
                pr.lastReadyTime = currentTick;
                if (policy === 'MLFQ') mlfqQueues[pr.mlfqLevel].push(nextPid);
                else readyQueue.push(nextPid);
              } else {
                pr.state = 'TERMINATED';
                pr.finishTime = currentTick;
                emit(currentTick, 'process_terminated', nextPid, {
                  turnaround: pr.finishTime - pr.spec.arrivalTime,
                  waiting: pr.readyWait
                });
              }
              trySchedule();
            });
          } else {
            pr.remainingBurst = nextBurst.duration;
            pr.state = 'READY';
            pr.lastReadyTime = currentTick;
            if (policy === 'MLFQ') mlfqQueues[pr.mlfqLevel].push(nextPid);
            else readyQueue.push(nextPid);
          }
        } else {
          pr.state = 'TERMINATED';
          pr.finishTime = currentTick;
          emit(currentTick, 'process_terminated', nextPid, {
            turnaround: pr.finishTime - pr.spec.arrivalTime,
            waiting: pr.readyWait,
            response: pr.firstRunTime - pr.spec.arrivalTime
          });
        }
        trySchedule();
      });
    }
  }

  // Register process arrivals
  for (const sp of workload) {
    const pid = sp.pid;
    schedule(sp.arrivalTime, 1, () => {
      const pr = procs.find(p => p.spec.pid === pid)!;
      pr.state = 'READY';
      pr.lastReadyTime = currentTick;

      if (policy === 'MLFQ') {
        mlfqQueues[0].push(pid);
      } else {
        readyQueue.push(pid);
      }

      emit(currentTick, 'process_arrived', pid, {
        priority: sp.basePriority,
        initialBurst: pr.remainingBurst
      });

      if (runningPid !== null && shouldPreempt(currentTick)) {
        const cur = procs.find(p => p.spec.pid === runningPid)!;
        cur.state = 'READY';
        cur.lastReadyTime = currentTick;
        if (policy === 'MLFQ') mlfqQueues[cur.mlfqLevel].push(runningPid);
        else readyQueue.push(runningPid);

        emit(currentTick, 'preempt', runningPid, {
          preemptedBy: pid,
          remainingBurst: cur.remainingBurst
        });
        runningPid = null;
      }

      trySchedule();
    });
  }

  // Simulation execution loop
  while (eventQueue.length > 0 && currentTick < 10000) {
    const nextEvt = eventQueue.shift()!;
    if (nextEvt.time > currentTick) {
      currentTick = nextEvt.time;
    }
    nextEvt.action();
  }

  // Compute metrics
  let totalWait = 0;
  let totalTurnaround = 0;
  let totalResponse = 0;
  let totalCpu = 0;
  let completed = 0;
  const cpuAllocations: number[] = [];

  const perProcess = procs.map(pr => {
    const wait = pr.readyWait;
    const turnaround = pr.finishTime >= 0 ? pr.finishTime - pr.spec.arrivalTime : currentTick - pr.spec.arrivalTime;
    const response = pr.firstRunTime >= 0 ? pr.firstRunTime - pr.spec.arrivalTime : 0;
    if (pr.finishTime >= 0) completed++;
    totalWait += wait;
    totalTurnaround += turnaround;
    totalResponse += response;
    totalCpu += pr.cpuService;
    cpuAllocations.push(pr.cpuService);

    return {
      pid: pr.spec.pid,
      waitingTime: wait,
      turnaroundTime: turnaround,
      responseTime: response,
      cpuService: pr.cpuService
    };
  });

  const n = procs.length || 1;
  let jain: number | null = null;
  if (cpuAllocations.length >= 2) {
    const sum = cpuAllocations.reduce((a, b) => a + b, 0);
    const sumSq = cpuAllocations.reduce((a, b) => a + b * b, 0);
    jain = sumSq > 0 ? (sum * sum) / (cpuAllocations.length * sumSq) : 1.0;
  }

  return {
    schemaVersion: 1,
    runId,
    status: 'completed',
    simulatedDuration: currentTick,
    events,
    metrics: {
      perProcess,
      averages: {
        waitingTime: totalWait / n,
        turnaroundTime: totalTurnaround / n,
        responseTime: totalResponse / n
      },
      throughput: currentTick > 0 ? completed / currentTick : 0,
      cpuUtilization: currentTick > 0 ? Math.min(1.0, totalCpu / currentTick) : 0,
      contextSwitches,
      jainFairness: jain
    }
  };
}

// -------------------------------------------------------------
// Virtual Memory & Paging Simulation Bridge
// -------------------------------------------------------------
export function runMemorySimulation(
  referenceString: number[],
  numFrames: number,
  policy: MemoryPolicy,
  tlbCapacity: number = 4
) {
  const events: SimEvent[] = [];
  let seq = 0;
  const runId = `mem-${policy.toLowerCase()}`;

  function emit(time: number, type: string, details: Record<string, any>) {
    events.push({
      schemaVersion: 1,
      runId,
      seq: seq++,
      time,
      subsystem: 'memory',
      type,
      pid: null,
      details
    });
  }

  interface FrameSlot {
    page: number | null;
    loadedAt: number;
    lastUsedAt: number;
    refBit: boolean;
  }

  const frames: FrameSlot[] = Array.from({ length: numFrames }, () => ({
    page: null,
    loadedAt: 0,
    lastUsedAt: 0,
    refBit: false
  }));

  const tlb: { page: number; frame: number; lastUsed: number }[] = [];
  let tlbHits = 0;
  let tlbMisses = 0;
  let pageFaults = 0;
  const fifoQueue: number[] = [];
  let clockHand = 0;

  referenceString.forEach((page, time) => {
    // 1. TLB Lookup
    const tlbIdx = tlb.findIndex(e => e.page === page);
    if (tlbCapacity > 0 && tlbIdx !== -1) {
      tlbHits++;
      tlb[tlbIdx].lastUsed = time;
      const fIdx = tlb[tlbIdx].frame;
      frames[fIdx].lastUsedAt = time;
      frames[fIdx].refBit = true;
      emit(time, 'tlb_hit', { page, frame: fIdx });
      return;
    }

    if (tlbCapacity > 0) {
      tlbMisses++;
      emit(time, 'tlb_miss', { page });
    }

    // 2. Physical Memory Hit Check
    const existingFrameIdx = frames.findIndex(f => f.page === page);
    if (existingFrameIdx !== -1) {
      frames[existingFrameIdx].lastUsedAt = time;
      frames[existingFrameIdx].refBit = true;
      // Add to TLB
      if (tlbCapacity > 0) {
        if (tlb.length >= tlbCapacity) tlb.sort((a, b) => a.lastUsed - b.lastUsed).shift();
        tlb.push({ page, frame: existingFrameIdx, lastUsed: time });
      }
      emit(time, 'page_access', { page, frame: existingFrameIdx, isHit: true });
      return;
    }

    // 3. Page Fault
    pageFaults++;
    const freeFrameIdx = frames.findIndex(f => f.page === null);
    let targetFrame = 0;
    let evictedPage: number | null = null;

    if (freeFrameIdx !== -1) {
      targetFrame = freeFrameIdx;
      if (policy === 'FIFO') fifoQueue.push(targetFrame);
    } else {
      if (policy === 'FIFO') {
        targetFrame = fifoQueue.shift()!;
        fifoQueue.push(targetFrame);
      } else if (policy === 'LRU') {
        let minTime = Infinity;
        frames.forEach((f, idx) => {
          if (f.lastUsedAt < minTime) {
            minTime = f.lastUsedAt;
            targetFrame = idx;
          }
        });
      } else if (policy === 'OPTIMAL') {
        let furthestNext = -1;
        frames.forEach((f, idx) => {
          let nextIdx = Infinity;
          for (let k = time + 1; k < referenceString.length; ++k) {
            if (referenceString[k] === f.page) {
              nextIdx = k;
              break;
            }
          }
          if (nextIdx > furthestNext) {
            furthestNext = nextIdx;
            targetFrame = idx;
          }
        });
      } else if (policy === 'CLOCK') {
        while (true) {
          const curr = clockHand % numFrames;
          if (!frames[curr].refBit) {
            targetFrame = curr;
            clockHand = (curr + 1) % numFrames;
            break;
          }
          frames[curr].refBit = false;
          clockHand = (curr + 1) % numFrames;
        }
      }

      evictedPage = frames[targetFrame].page;
      // Invalidate TLB
      const tlbPos = tlb.findIndex(e => e.page === evictedPage);
      if (tlbPos !== -1) tlb.splice(tlbPos, 1);

      emit(time, 'frame_evicted', { frame: targetFrame, evictedPage, policy });
    }

    frames[targetFrame] = {
      page,
      loadedAt: time,
      lastUsedAt: time,
      refBit: true
    };

    if (tlbCapacity > 0) {
      if (tlb.length >= tlbCapacity) tlb.sort((a, b) => a.lastUsed - b.lastUsed).shift();
      tlb.push({ page, frame: targetFrame, lastUsed: time });
    }

    emit(time, 'page_fault', { page, frame: targetFrame, policy });
    emit(time, 'frame_loaded', { page, frame: targetFrame });
  });

  return {
    events,
    metrics: {
      totalAccesses: referenceString.length,
      pageFaults,
      faultRate: referenceString.length > 0 ? pageFaults / referenceString.length : 0,
      tlbHits,
      tlbMisses,
      tlbHitRate: (tlbHits + tlbMisses) > 0 ? tlbHits / (tlbHits + tlbMisses) : 0
    },
    frames
  };
}

// -------------------------------------------------------------
// Disk Scheduling Simulation Bridge
// -------------------------------------------------------------
export function runDiskSimulation(
  requests: number[],
  initialHead: number,
  policy: DiskPolicy,
  maxCylinder: number = 199,
  direction: 'UP' | 'DOWN' = 'UP'
) {
  const events: SimEvent[] = [];
  let seq = 0;
  const runId = `disk-${policy.toLowerCase()}`;
  let currentHead = initialHead;
  let totalSeek = 0;
  const serviceOrder: number[] = [];

  function emitStep(step: number, from: number, to: number) {
    const dist = Math.abs(to - from);
    totalSeek += dist;
    serviceOrder.push(to);
    events.push({
      schemaVersion: 1,
      runId,
      seq: seq++,
      time: step,
      subsystem: 'disk',
      type: 'disk_request_serviced',
      pid: null,
      details: { fromCylinder: from, toCylinder: to, distance: dist, accumulatedSeek: totalSeek, policy }
    });
  }

  if (policy === 'FCFS') {
    requests.forEach((req, idx) => {
      emitStep(idx + 1, currentHead, req);
      currentHead = req;
    });
  } else if (policy === 'SSTF') {
    const pending = [...requests];
    let step = 1;
    while (pending.length > 0) {
      let bestIdx = 0;
      let minDist = Math.abs(pending[0] - currentHead);
      for (let i = 1; i < pending.length; ++i) {
        const d = Math.abs(pending[i] - currentHead);
        if (d < minDist || (d === minDist && pending[i] < pending[bestIdx])) {
          minDist = d;
          bestIdx = i;
        }
      }
      const sel = pending.splice(bestIdx, 1)[0];
      emitStep(step++, currentHead, sel);
      currentHead = sel;
    }
  } else if (policy === 'SCAN') {
    const upper = requests.filter(r => r >= initialHead).sort((a, b) => a - b);
    const lower = requests.filter(r => r < initialHead).sort((a, b) => b - a);
    let step = 1;
    if (direction === 'UP') {
      upper.forEach(r => { emitStep(step++, currentHead, r); currentHead = r; });
      if (lower.length > 0) {
        totalSeek += Math.abs(maxCylinder - currentHead);
        currentHead = maxCylinder;
        lower.forEach(r => { emitStep(step++, currentHead, r); currentHead = r; });
      }
    } else {
      lower.forEach(r => { emitStep(step++, currentHead, r); currentHead = r; });
      if (upper.length > 0) {
        totalSeek += currentHead;
        currentHead = 0;
        upper.reverse().forEach(r => { emitStep(step++, currentHead, r); currentHead = r; });
      }
    }
  } else if (policy === 'LOOK') {
    const upper = requests.filter(r => r >= initialHead).sort((a, b) => a - b);
    const lower = requests.filter(r => r < initialHead).sort((a, b) => b - a);
    let step = 1;
    if (direction === 'UP') {
      upper.forEach(r => { emitStep(step++, currentHead, r); currentHead = r; });
      lower.forEach(r => { emitStep(step++, currentHead, r); currentHead = r; });
    } else {
      lower.forEach(r => { emitStep(step++, currentHead, r); currentHead = r; });
      upper.forEach(r => { emitStep(step++, currentHead, r); currentHead = r; });
    }
  } else if (policy === 'C-SCAN') {
    const upper = requests.filter(r => r >= initialHead).sort((a, b) => a - b);
    const lower = requests.filter(r => r < initialHead).sort((a, b) => a - b);
    let step = 1;
    upper.forEach(r => { emitStep(step++, currentHead, r); currentHead = r; });
    if (lower.length > 0) {
      totalSeek += Math.abs(maxCylinder - currentHead) + maxCylinder;
      currentHead = 0;
      lower.forEach(r => { emitStep(step++, currentHead, r); currentHead = r; });
    }
  } else if (policy === 'C-LOOK') {
    const upper = requests.filter(r => r >= initialHead).sort((a, b) => a - b);
    const lower = requests.filter(r => r < initialHead).sort((a, b) => a - b);
    let step = 1;
    upper.forEach(r => { emitStep(step++, currentHead, r); currentHead = r; });
    lower.forEach(r => { emitStep(step++, currentHead, r); currentHead = r; });
  }

  return {
    events,
    totalSeekDistance: totalSeek,
    serviceOrder
  };
}
