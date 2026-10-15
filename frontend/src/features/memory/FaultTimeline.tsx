import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SimEvent } from '../../bridge/schema';

export interface FaultTimelineProps {
  events: SimEvent[];
  currentTick: number;
  totalTicks: number;
  referenceString: number[];
  onSeek?: (tick: number) => void;
  emptyMessage?: string;
}

export const FaultTimeline: React.FC<FaultTimelineProps> = ({
  events,
  currentTick,
  totalTicks,
  referenceString,
  onSeek,
  emptyMessage = 'No memory events recorded'
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || referenceString.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = Math.max(760, referenceString.length * 48 + 100);
    const height = 150;
    const margin = { top: 25, right: 30, bottom: 35, left: 60 };

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const xScale = d3.scaleLinear()
      .domain([0, Math.max(1, referenceString.length - 1)])
      .range([margin.left, width - margin.right]);

    // Build timeline data items per tick
    const items = referenceString.map((page, tick) => {
      const tickEvents = events.filter(e => e.time === tick && e.subsystem === 'memory');
      const isFault = tickEvents.some(e => e.type === 'page_fault');
      const isTlbHit = tickEvents.some(e => e.type === 'tlb_hit');
      const evictionEvt = tickEvents.find(e => e.type === 'frame_evicted');
      const evictedPage = evictionEvt?.details?.evictedPage ?? null;

      return {
        tick,
        page,
        isFault,
        isTlbHit,
        evictedPage
      };
    });

    // Background track line
    svg.append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', 75)
      .attr('y2', 75)
      .attr('stroke', 'var(--border-subtle)')
      .attr('stroke-width', 2);

    // Interactive tick columns
    items.forEach(d => {
      const cx = xScale(d.tick);
      const isPast = d.tick <= currentTick;
      const isCurrent = d.tick === currentTick;

      const group = svg.append('g')
        .attr('class', 'tick-column')
        .style('cursor', onSeek ? 'pointer' : 'default')
        .on('click', () => onSeek && onSeek(d.tick));

      // Tick index label on top
      group.append('text')
        .attr('x', cx)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .text(`t=${d.tick}`)
        .attr('fill', isCurrent ? 'var(--primary-cyan)' : 'var(--text-subtle)')
        .attr('font-size', '10px')
        .attr('font-family', 'var(--font-mono)')
        .attr('font-weight', isCurrent ? '700' : '400');

      // Reference page circle
      group.append('circle')
        .attr('cx', cx)
        .attr('cy', 44)
        .attr('r', 14)
        .attr('fill', isCurrent ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.04)')
        .attr('stroke', isCurrent ? 'var(--primary-cyan)' : 'var(--border-subtle)')
        .attr('stroke-width', isCurrent ? 2 : 1);

      group.append('text')
        .attr('x', cx)
        .attr('y', 48)
        .attr('text-anchor', 'middle')
        .text(`${d.page}`)
        .attr('fill', isCurrent ? 'var(--primary-cyan)' : 'var(--text-main)')
        .attr('font-size', '12px')
        .attr('font-family', 'var(--font-mono)')
        .attr('font-weight', '700');

      // Page Fault vs Hit accessible marker
      if (isPast) {
        if (d.isFault) {
          // Fault marker (Prominent accessible red diamond / tag)
          group.append('polygon')
            .attr('points', `${cx},68 ${cx + 9},77 ${cx},86 ${cx - 9},77`)
            .attr('fill', '#ef4444')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .style('filter', 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.5))');

          group.append('text')
            .attr('x', cx)
            .attr('y', 80)
            .attr('text-anchor', 'middle')
            .text('F')
            .attr('fill', '#fff')
            .attr('font-size', '9px')
            .attr('font-weight', '800')
            .attr('font-family', 'var(--font-mono)');

          // Accessible marker description
          group.append('title')
            .text(`Tick ${d.tick}: Page Fault on P${d.page}${d.evictedPage !== null ? ` (Evicted P${d.evictedPage})` : ''}`);
        } else {
          // Hit marker (Emerald circle)
          group.append('circle')
            .attr('cx', cx)
            .attr('cy', 77)
            .attr('r', 7)
            .attr('fill', 'var(--accent-emerald)')
            .attr('stroke', 'rgba(255, 255, 255, 0.3)')
            .attr('stroke-width', 1);

          group.append('text')
            .attr('x', cx)
            .attr('y', 80)
            .attr('text-anchor', 'middle')
            .text('H')
            .attr('fill', '#070a12')
            .attr('font-size', '8px')
            .attr('font-weight', '800')
            .attr('font-family', 'var(--font-mono)');

          group.append('title')
            .text(`Tick ${d.tick}: Page Hit on P${d.page}`);
        }

        // TLB status row at bottom
        group.append('rect')
          .attr('x', cx - 12)
          .attr('y', 100)
          .attr('width', 24)
          .attr('height', 16)
          .attr('rx', 3)
          .attr('fill', d.isTlbHit ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)')
          .attr('stroke', d.isTlbHit ? 'var(--primary-cyan)' : 'rgba(255, 255, 255, 0.08)');

        group.append('text')
          .attr('x', cx)
          .attr('y', 112)
          .attr('text-anchor', 'middle')
          .text(d.isTlbHit ? 'TLB' : 'miss')
          .attr('fill', d.isTlbHit ? 'var(--primary-cyan)' : 'var(--text-subtle)')
          .attr('font-size', '8px')
          .attr('font-family', 'var(--font-mono)')
          .attr('font-weight', d.isTlbHit ? '700' : '400');
      } else {
        // Unreached future tick marker
        group.append('circle')
          .attr('cx', cx)
          .attr('cy', 77)
          .attr('r', 4)
          .attr('fill', 'rgba(255, 255, 255, 0.08)');
      }
    });

    // Playhead Scrubber Vertical Indicator
    const needleX = xScale(Math.min(currentTick, Math.max(0, referenceString.length - 1)));
    svg.append('line')
      .attr('x1', needleX)
      .attr('x2', needleX)
      .attr('y1', 10)
      .attr('y2', height - 15)
      .attr('stroke', '#ff4b2b')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '3 2');

    svg.append('circle')
      .attr('cx', needleX)
      .attr('cy', 10)
      .attr('r', 4)
      .attr('fill', '#ff4b2b');

  }, [events, currentTick, totalTicks, referenceString, onSeek]);

  if (!referenceString || referenceString.length === 0 || !events || events.length === 0) {
    return (
      <div
        role="region"
        aria-label="Fault Timeline"
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          fontStyle: 'italic',
          background: 'rgba(5, 8, 14, 0.4)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-subtle)'
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Memory Page Fault and Hit Timeline"
      style={{ width: '100%', overflowX: 'auto', background: 'rgba(5, 8, 14, 0.6)', borderRadius: 'var(--radius-md)', padding: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
        <span style={{ fontWeight: 600 }}>Reference String Access Timeline</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: '#ef4444', display: 'inline-block' }} />
            <span>Page Fault (F)</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block' }} />
            <span>Page Hit (H)</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 8, borderRadius: 2, background: 'var(--primary-cyan)', display: 'inline-block' }} />
            <span>TLB Hit</span>
          </span>
        </div>
      </div>
      <svg ref={svgRef} style={{ width: '100%', height: 'auto', display: 'block' }}></svg>
    </div>
  );
};
