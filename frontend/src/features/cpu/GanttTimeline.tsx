import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Maximize2 } from 'lucide-react';
import { SimEvent, ProcessSpec } from '../../bridge/schema';

interface GanttTimelineProps {
  events: SimEvent[];
  processes: ProcessSpec[];
  currentTick: number;
  maxTick: number;
  quantum?: number;
  reducedMotion?: boolean;
  onScrub?: (tick: number) => void;
}

interface GanttSegment {
  id: string;
  pid: number | 'core0';
  start: number;
  end: number;
  state: 'RUNNING' | 'WAITING' | 'CONTEXT_SWITCH';
  reason?: string;
  details?: Record<string, any>;
  isPreempted?: boolean;
}

export const GanttTimeline: React.FC<GanttTimelineProps> = ({
  events,
  processes,
  currentTick,
  maxTick,
  quantum = 3,
  reducedMotion = false,
  onScrub
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Zoom / Viewport scale factor (1x, 2x, 3x, 4x)
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Floating tooltip state
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    data: GanttSegment | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    data: null
  });

  // Extract intervals and segments from normalized C++ event log
  const segments = useMemo(() => {
    const list: GanttSegment[] = [];
    if (!events || events.length === 0) return list;

    // Track ongoing bursts per process and on Core 0
    let currentRunningPid: number | null = null;
    let currentStartTick = 0;
    let lastEventReason: string | undefined = undefined;

    // Sort events deterministically by sequence
    const sorted = [...events].sort((a, b) => a.seq - b.seq);

    for (let i = 0; i < sorted.length; i++) {
      const ev = sorted[i];

      if (ev.type === 'dispatch' || ev.type === 'CONTEXT_SWITCH' || ev.type === 'DISPATCH') {
        const nextPid = ev.pid ?? ev.details?.toPid ?? ev.details?.incomingPid;

        // If another process was running, close its segment
        if (currentRunningPid !== null && currentRunningPid !== nextPid) {
          if (ev.time > currentStartTick) {
            // Process lane segment
            list.push({
              id: `seg-${currentRunningPid}-${currentStartTick}-${ev.time}`,
              pid: currentRunningPid,
              start: currentStartTick,
              end: ev.time,
              state: 'RUNNING',
              reason: lastEventReason || 'Preempted / Switch',
              isPreempted: lastEventReason === 'preempt' || ev.details?.reason === 'higher_priority_arrived'
            });

            // Master Core 0 aggregate segment
            list.push({
              id: `core0-${currentRunningPid}-${currentStartTick}-${ev.time}`,
              pid: 'core0',
              start: currentStartTick,
              end: ev.time,
              state: 'RUNNING',
              reason: `P${currentRunningPid} Executing`
            });
          }
        }

        currentRunningPid = nextPid;
        currentStartTick = ev.time;
        lastEventReason = ev.details?.reason;
      } else if (
        ev.type === 'quantum_expired' ||
        ev.type === 'preempt' ||
        ev.type === 'PREEMPT' ||
        ev.type === 'QUANTUM_EXPIRED'
      ) {
        lastEventReason = ev.type.toLowerCase();
        if (currentRunningPid !== null && ev.time > currentStartTick) {
          list.push({
            id: `seg-${currentRunningPid}-${currentStartTick}-${ev.time}`,
            pid: currentRunningPid,
            start: currentStartTick,
            end: ev.time,
            state: 'RUNNING',
            reason: ev.type,
            isPreempted: true
          });
          list.push({
            id: `core0-${currentRunningPid}-${currentStartTick}-${ev.time}`,
            pid: 'core0',
            start: currentStartTick,
            end: ev.time,
            state: 'RUNNING',
            reason: `P${currentRunningPid} (${ev.type})`
          });
          currentRunningPid = null;
        }
      } else if (
        ev.type === 'cpu_burst_completed' ||
        ev.type === 'process_terminated' ||
        ev.type === 'PROCESS_TERMINATED'
      ) {
        if (currentRunningPid !== null && ev.time > currentStartTick) {
          list.push({
            id: `seg-${currentRunningPid}-${currentStartTick}-${ev.time}`,
            pid: currentRunningPid,
            start: currentStartTick,
            end: ev.time,
            state: 'RUNNING',
            reason: 'Burst Completed'
          });
          list.push({
            id: `core0-${currentRunningPid}-${currentStartTick}-${ev.time}`,
            pid: 'core0',
            start: currentStartTick,
            end: ev.time,
            state: 'RUNNING',
            reason: `P${currentRunningPid} Completed`
          });
          currentRunningPid = null;
        }
      } else if (ev.type === 'io_started' || ev.type === 'IO_BURST_STARTED') {
        const ioPid = ev.pid;
        const ioDuration = ev.details?.duration ?? 2;
        if (ioPid !== null && ioPid !== undefined) {
          list.push({
            id: `io-${ioPid}-${ev.time}`,
            pid: ioPid,
            start: ev.time,
            end: ev.time + ioDuration,
            state: 'WAITING',
            reason: `I/O on ${ev.details?.device || 'disk0'}`
          });
        }
      }
    }

    // Close any trailing running burst at maxTick
    if (currentRunningPid !== null && maxTick > currentStartTick) {
      list.push({
        id: `seg-${currentRunningPid}-${currentStartTick}-${maxTick}`,
        pid: currentRunningPid,
        start: currentStartTick,
        end: maxTick,
        state: 'RUNNING',
        reason: 'Execution Finish'
      });
      list.push({
        id: `core0-${currentRunningPid}-${currentStartTick}-${maxTick}`,
        pid: 'core0',
        start: currentStartTick,
        end: maxTick,
        state: 'RUNNING',
        reason: `P${currentRunningPid} Finished`
      });
    }

    return list;
  }, [events, maxTick]);

  // D3 Rendering Pipeline
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const safeDuration = Math.max(1, maxTick);
    const pids = processes.map((p) => p.pid);
    const rowKeys: (number | 'core0')[] = [...pids, 'core0'];

    const rowHeight = 28; // docs/ux-system.md Section 3.1: fixed at 28px
    const rowGap = 4; // docs/ux-system.md Section 3.1: 4px gap
    const margin = { top: 35, right: 30, bottom: 25, left: 95 };

    const baseWidth = Math.max(760, safeDuration * 24 * zoomLevel);
    const totalHeight = margin.top + rowKeys.length * (rowHeight + rowGap) + margin.bottom;

    svg.attr('width', baseWidth).attr('height', totalHeight);

    // Definitions: Hatch patterns for WAITING and CONTEXT_SWITCH
    const defs = svg.append('defs');

    // 45° hatch for Waiting (I/O)
    const hatchWaiting = defs
      .append('pattern')
      .attr('id', 'hatch-waiting')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 8)
      .attr('height', 8);
    hatchWaiting
      .append('rect')
      .attr('width', 8)
      .attr('height', 8)
      .attr('fill', '#261b14');
    hatchWaiting
      .append('path')
      .attr('d', 'M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4')
      .attr('stroke', '#C05621')
      .attr('stroke-width', 1.5);

    // Marker: Preemption downward arrow marker
    const marker = defs
      .append('marker')
      .attr('id', 'preempt-arrow')
      .attr('viewBox', '0 0 6 6')
      .attr('refX', 3)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto');
    marker
      .append('polygon')
      .attr('points', '0,0 6,0 3,5')
      .attr('fill', '#e53e3e');

    // X Scale: Discrete Simulation Ticks
    const xScale = d3
      .scaleLinear()
      .domain([0, safeDuration])
      .range([margin.left, baseWidth - margin.right]);

    // Y Scale: Process Lanes
    const yScale = d3
      .scaleBand<number | 'core0'>()
      .domain(rowKeys)
      .range([margin.top, totalHeight - margin.bottom])
      .paddingInner(rowGap / (rowHeight + rowGap));

    // 1. Grid Layer (Ticks and Quantum boundaries)
    const gridGroup = svg.append('g').attr('class', 'grid-layer');

    // Major quantum lines
    const quantumTicks: number[] = [];
    for (let t = 0; t <= safeDuration; t += Math.max(1, quantum)) {
      quantumTicks.push(t);
    }

    gridGroup
      .selectAll('.grid-quantum')
      .data(quantumTicks)
      .enter()
      .append('line')
      .attr('class', 'grid-quantum')
      .attr('x1', (d) => xScale(d))
      .attr('x2', (d) => xScale(d))
      .attr('y1', margin.top - 8)
      .attr('y2', totalHeight - margin.bottom)
      .attr('stroke', 'var(--grid-line-major, #212733)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2 2');

    // 2. Top X-Axis Time Ruler
    const xAxis = d3
      .axisTop(xScale)
      .ticks(Math.min(safeDuration, Math.floor(baseWidth / 45)))
      .tickFormat((d) => `${d}t`);

    const axisGroup = svg
      .append('g')
      .attr('transform', `translate(0, ${margin.top - 4})`)
      .call(xAxis)
      .attr('color', 'var(--border-strong, #2d3542)');

    axisGroup.selectAll('text')
      .attr('font-family', 'var(--font-mono, monospace)')
      .attr('font-size', '10px')
      .attr('fill', 'var(--text-subtle, #94a3b8)');

    axisGroup.select('.domain').attr('stroke', 'var(--border-strong, #2d3542)');

    // 3. Lane Background Rows & Labels
    const lanesGroup = svg.append('g').attr('class', 'lanes-layer');

    rowKeys.forEach((key) => {
      const y = yScale(key) ?? 0;
      const isCore0 = key === 'core0';

      // Row background
      lanesGroup
        .append('rect')
        .attr('x', margin.left)
        .attr('y', y)
        .attr('width', baseWidth - margin.left - margin.right)
        .attr('height', rowHeight)
        .attr('fill', isCore0 ? '#10141a' : 'var(--surface-subpanel, #181d24)')
        .attr('stroke', isCore0 ? 'var(--border-contrast, #434f63)' : 'var(--border-subtle, #1f242d)')
        .attr('stroke-width', 1)
        .attr('rx', 2);

      // Row Label
      const labelText = isCore0 ? 'CPU CORE 0' : `PID ${key}`;
      lanesGroup
        .append('text')
        .attr('x', margin.left - 12)
        .attr('y', y + rowHeight / 2 + 4)
        .attr('text-anchor', 'end')
        .attr('font-family', 'var(--font-mono, monospace)')
        .attr('font-size', isCore0 ? '10px' : '11px')
        .attr('font-weight', isCore0 ? 700 : 600)
        .attr('fill', isCore0 ? 'var(--primary-cyan, #00f2fe)' : 'var(--text-main, #f8fafc)')
        .text(labelText);
    });

    // 4. Gantt Burst Segments Layer
    const barsGroup = svg.append('g').attr('class', 'bars-layer');

    // Distinct palette tested for accessibility
    const pidColors: Record<number, string> = {
      1: '#00A389', // High luminance teal/emerald
      2: '#2B6CB0', // Deep sapphire
      3: '#D69E2E', // Warm amber
      4: '#9F7AEA', // Soft purple
      5: '#38A169', // Forest jade
      6: '#319795', // Cyan-teal
      7: '#E53E3E'  // Ruby
    };

    segments.forEach((seg) => {
      const y = yScale(seg.pid);
      if (y === undefined) return;

      const isCore0 = seg.pid === 'core0';
      const isVisible = seg.start <= currentTick;
      const visibleEnd = Math.min(seg.end, currentTick);

      if (!isVisible || visibleEnd <= seg.start) return;

      const x = xScale(seg.start);
      const width = Math.max(1.5, xScale(visibleEnd) - x);

      let fillColor = '#00A389';
      if (seg.state === 'WAITING') {
        fillColor = 'url(#hatch-waiting)';
      } else if (typeof seg.pid === 'number') {
        fillColor = pidColors[seg.pid] || '#00A389';
      } else if (isCore0) {
        fillColor = '#00A389';
      }

      // Main Segment Rectangle
      const rect = barsGroup
        .append('rect')
        .attr('x', x)
        .attr('y', y + 1)
        .attr('width', width)
        .attr('height', rowHeight - 2)
        .attr('fill', fillColor)
        .attr('stroke', '#0b0d10')
        .attr('stroke-width', 1)
        .attr('rx', 2)
        .style('cursor', 'pointer');

      // Preemption arrow marker at end of preempted slice
      if (seg.isPreempted && visibleEnd === seg.end) {
        barsGroup
          .append('polygon')
          .attr('points', `${xScale(seg.end) - 3},${y} ${xScale(seg.end) + 3},${y} ${xScale(seg.end)},${y + 4}`)
          .attr('fill', '#e53e3e');
      }

      // In-bar text label if wide enough
      if (width > 26) {
        barsGroup
          .append('text')
          .attr('x', x + 5)
          .attr('y', y + rowHeight / 2 + 3)
          .attr('font-family', 'var(--font-mono, monospace)')
          .attr('font-size', '10px')
          .attr('font-weight', 700)
          .attr('fill', '#070a12')
          .text(isCore0 ? `${seg.start}-${seg.end}` : `P${seg.pid} [${seg.start}-${seg.end}]`);
      }

      // Interactive tooltip event bindings
      rect
        .on('mouseenter', (event) => {
          const [mx, my] = d3.pointer(event, containerRef.current);
          setTooltip({
            visible: true,
            x: mx + 12,
            y: my - 10,
            data: seg
          });
        })
        .on('mousemove', (event) => {
          const [mx, my] = d3.pointer(event, containerRef.current);
          setTooltip((prev) => ({
            ...prev,
            x: mx + 12,
            y: my - 10
          }));
        })
        .on('mouseleave', () => {
          setTooltip((prev) => ({ ...prev, visible: false }));
        });
    });

    // 5. Interactive Click-to-Scrub on SVG Canvas
    svg.on('click', (event) => {
      if (!onScrub) return;
      const [mx] = d3.pointer(event);
      if (mx >= margin.left && mx <= baseWidth - margin.right) {
        const clickedTick = Math.round(xScale.invert(mx));
        onScrub(Math.max(0, Math.min(safeDuration, clickedTick)));
      }
    });

    // 6. Current-Time Playhead Layer (docs/ux-system.md Section 3.1)
    const playheadGroup = svg.append('g').attr('class', 'playhead-layer');
    const playheadX = xScale(currentTick);

    // Hairline
    const line = playheadGroup
      .append('line')
      .attr('x1', playheadX)
      .attr('x2', playheadX)
      .attr('y1', margin.top - 18)
      .attr('y2', totalHeight - margin.bottom)
      .attr('stroke', 'var(--telemetry-cyan, #00f2fe)')
      .attr('stroke-width', 1.5)
      .style('pointer-events', 'none');

    // Reverse-triangle flag at top displaying T={now}
    const flagGroup = playheadGroup
      .append('g')
      .attr('transform', `translate(${playheadX}, ${margin.top - 18})`)
      .style('pointer-events', 'none');

    flagGroup
      .append('polygon')
      .attr('points', '-18,-14 18,-14 18,-2 0,4 -18,-2')
      .attr('fill', '#0284c7')
      .attr('stroke', '#00f2fe')
      .attr('stroke-width', 1);

    flagGroup
      .append('text')
      .attr('x', 0)
      .attr('y', -4)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-mono, monospace)')
      .attr('font-size', '9px')
      .attr('font-weight', 700)
      .attr('fill', '#ffffff')
      .text(`T=${currentTick}`);

    if (!reducedMotion) {
      line.style('transition', 'x1 80ms ease, x2 80ms ease');
      flagGroup.style('transition', 'transform 80ms ease');
    }
  }, [segments, processes, currentTick, maxTick, quantum, zoomLevel, reducedMotion, onScrub]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: '100%',
        position: 'relative'
      }}
    >
      {/* Zoom / Viewport Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 8px',
          background: 'var(--surface-subpanel, #181d24)',
          border: '1px solid var(--border-subtle, #1f242d)',
          borderRadius: 'var(--radius-sm, 2px)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono, monospace)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--text-subtle, #94a3b8)', fontWeight: 600 }}>
            D3 GANTT TIMELINE:
          </span>
          <span style={{ color: 'var(--primary-cyan, #00f2fe)' }}>
            {processes.length} Processes + Core 0
          </span>
          <span style={{ color: 'var(--text-subtle, #64748b)' }}>|</span>
          <span style={{ color: 'var(--text-subtle, #94a3b8)' }}>Quantum: {quantum}t</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: 'var(--text-subtle, #94a3b8)', marginRight: 4 }}>SCALE:</span>
          {[1, 1.5, 2, 3].map((z) => (
            <button
              key={z}
              onClick={() => setZoomLevel(z)}
              className={`btn-secondary ${zoomLevel === z ? 'btn-active' : ''}`}
              style={{ padding: '2px 6px', fontSize: '10px' }}
              aria-label={`Zoom level ${z}x`}
            >
              {z}x
            </button>
          ))}
          <button
            onClick={() => setZoomLevel(1)}
            className="btn-secondary"
            title="Reset scale"
            style={{ padding: '2px 5px', fontSize: '10px' }}
            aria-label="Reset zoom"
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </div>

      {/* SVG Canvas Container with Horizontal Scroll */}
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          background: 'var(--surface-canvas, #0b0d10)',
          border: '1px solid var(--border-subtle, #1f242d)',
          borderRadius: 'var(--radius-sm, 2px)',
          position: 'relative'
        }}
        tabIndex={0}
        role="region"
        aria-label="Interactive CPU Gantt Timeline Canvas"
      >
        <svg ref={svgRef} style={{ display: 'block', margin: '0 auto' }} />

        {/* Floating Technical Tooltip */}
        {tooltip.visible && tooltip.data && (
          <div
            className="tooltip-custom"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontWeight: 700 }}>
              <span style={{ color: 'var(--primary-cyan, #00f2fe)' }}>
                {tooltip.data.pid === 'core0' ? 'CPU CORE 0' : `PROCESS P${tooltip.data.pid}`}
              </span>
              <span className={`badge ${tooltip.data.state === 'RUNNING' ? 'badge-emerald' : 'badge-amber'}`}>
                {tooltip.data.state}
              </span>
            </div>
            <div style={{ color: 'var(--text-subtle, #94a3b8)' }}>
              Interval: <span style={{ color: 'var(--text-main, #f8fafc)' }}>[{tooltip.data.start}t → {tooltip.data.end}t]</span> ({tooltip.data.end - tooltip.data.start} ticks)
            </div>
            {tooltip.data.reason && (
              <div style={{ color: 'var(--text-subtle, #94a3b8)' }}>
                Reason: <span style={{ color: '#fef08a' }}>{tooltip.data.reason}</span>
              </div>
            )}
            {tooltip.data.isPreempted && (
              <div style={{ color: '#ef4444', fontWeight: 600 }}>
                ▼ Preempted at tick {tooltip.data.end}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend Bar (docs/ux-system.md Section 2.1) */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '4px 8px',
          fontSize: '10px',
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--text-subtle, #94a3b8)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 10, height: 10, background: '#00A389', borderRadius: 2 }} />
          <span>RUNNING</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 10, height: 10, background: '#2B6CB0', borderRadius: 2 }} />
          <span>READY (Enqueued)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              width: 10,
              height: 10,
              background: 'repeating-linear-gradient(45deg, #261b14, #261b14 2px, #C05621 2px, #C05621 4px)',
              borderRadius: 2
            }}
          />
          <span>WAITING (I/O)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid #e53e3e' }} />
          <span>Preemption Point</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 12, height: 2, background: 'var(--grid-line-major, #212733)', borderTop: '1px dashed #64748b' }} />
          <span>Quantum Boundary</span>
        </div>
      </div>
    </div>
  );
};
