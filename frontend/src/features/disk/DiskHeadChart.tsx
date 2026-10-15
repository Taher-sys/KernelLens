import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  HardDrive,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Info,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { DiskPolicy, SimEvent } from '../../bridge/schema';

export interface DiskHeadChartProps {
  requests: number[];
  initialHead: number;
  policy: DiskPolicy;
  maxCylinder?: number;
  direction?: 'UP' | 'DOWN';
  simResult?: {
    events: SimEvent[];
    totalSeekDistance: number;
    serviceOrder: number[];
  } | null;
}

interface TrajectoryPoint {
  step: number;
  cylinder: number;
  seekDistance: number;
  cumulativeSeek: number;
  isWrapJump?: boolean;
  label?: string;
}

export const DiskHeadChart: React.FC<DiskHeadChartProps> = ({
  requests,
  initialHead,
  policy,
  maxCylinder = 199,
  direction = 'UP',
  simResult
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedPoint, setSelectedPoint] = useState<TrajectoryPoint | null>(null);

  const trajectorySvgRef = useRef<SVGSVGElement | null>(null);
  const cumulativeSvgRef = useRef<SVGSVGElement | null>(null);

  // If requests array is empty, show explicit empty queue state
  const isEmpty = requests.length === 0 || !simResult || simResult.serviceOrder.length === 0;

  // Build the complete trajectory points from the engine response events
  const trajectoryPoints: TrajectoryPoint[] = useMemo(() => {
    if (isEmpty || !simResult) return [];

    const points: TrajectoryPoint[] = [];

    // Point 0: Initial head position
    points.push({
      step: 0,
      cylinder: initialHead,
      seekDistance: 0,
      cumulativeSeek: 0,
      label: `Start (${initialHead})`
    });

    let currentAccumulated = 0;
    let prevCyl = initialHead;

    // Build from engine events
    simResult.events.forEach((ev, idx) => {
      if (ev.type === 'disk_request_serviced') {
        const from = ev.details.fromCylinder ?? prevCyl;
        const to = ev.details.toCylinder;
        const dist = ev.details.distance ?? Math.abs(to - from);
        currentAccumulated = ev.details.accumulatedSeek ?? (currentAccumulated + dist);

        // Check if there was an intermediate boundary jump in SCAN/C-SCAN
        // In SCAN with direction UP: if upper finished, head reaches maxCylinder before reversing
        if (policy === 'SCAN' && from < to && prevCyl < from) {
          // Boundary visited
        }

        // Detect C-SCAN wrap jump
        // In C-SCAN: jump from maxCylinder to 0 (or vice versa) without servicing
        const isWrap = policy === 'C-SCAN' && from > to && dist >= maxCylinder / 2;

        points.push({
          step: idx + 1,
          cylinder: to,
          seekDistance: dist,
          cumulativeSeek: currentAccumulated,
          isWrapJump: isWrap,
          label: `#${idx + 1} (${to})`
        });

        prevCyl = to;
      }
    });

    return points;
  }, [isEmpty, simResult, initialHead, policy, maxCylinder]);

  const maxSteps = Math.max(0, trajectoryPoints.length - 1);

  // Reset current step when requests or policy change
  useEffect(() => {
    setCurrentStep(maxSteps);
    setIsPlaying(false);
  }, [requests, policy, maxSteps]);

  // Autoplay animation loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= maxSteps) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [isPlaying, maxSteps]);

  // D3 Rendering: Cylinder Trajectory Plot
  useEffect(() => {
    if (!trajectorySvgRef.current || isEmpty) return;

    const svg = d3.select(trajectorySvgRef.current);
    const width = 640;
    const height = 300;
    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.selectAll('*').remove();

    // Definitions
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow-head')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'var(--primary-cyan)');

    defs.append('marker')
      .attr('id', 'arrow-wrap')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'var(--accent-amber)');

    // Scales
    // X-axis: Cylinder space (0 to maxCylinder)
    const xScale = d3.scaleLinear()
      .domain([0, maxCylinder])
      .range([0, innerWidth]);

    // Y-axis: Time / Step (0 to maxSteps)
    const yScale = d3.scaleLinear()
      .domain([0, Math.max(1, maxSteps)])
      .range([0, innerHeight]);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(8)
          .tickSize(-innerHeight)
          .tickFormat(() => '')
      )
      .call(gAxis => gAxis.select('.domain').remove())
      .call(gAxis => gAxis.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.05)'));

    // Top X-Axis (Textbook convention has cylinder numbers at the top)
    g.append('g')
      .call(d3.axisTop(xScale).ticks(8))
      .call(gAxis => gAxis.select('.domain').attr('stroke', 'var(--border-subtle)'))
      .call(gAxis => gAxis.selectAll('text').attr('fill', 'var(--text-subtle)').attr('font-size', '10px'))
      .call(gAxis => gAxis.selectAll('line').attr('stroke', 'var(--border-subtle)'));

    // Left Y-Axis (Step number)
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(Math.min(8, maxSteps)).tickFormat(d => `Step ${d}`))
      .call(gAxis => gAxis.select('.domain').attr('stroke', 'var(--border-subtle)'))
      .call(gAxis => gAxis.selectAll('text').attr('fill', 'var(--text-subtle)').attr('font-size', '10px'))
      .call(gAxis => gAxis.selectAll('line').attr('stroke', 'var(--border-subtle)'));

    // Visible points up to currentStep
    const visiblePoints = trajectoryPoints.slice(0, currentStep + 1);

    // Draw trajectory line segments
    for (let i = 0; i < visiblePoints.length - 1; ++i) {
      const p1 = visiblePoints[i];
      const p2 = visiblePoints[i + 1];

      // Avoid misleading animation: If this is a C-SCAN wrap jump, style as distinct dashed line
      const isWrap = p2.isWrapJump || (policy === 'C-SCAN' && p1.cylinder > p2.cylinder && (p1.cylinder - p2.cylinder) > maxCylinder / 2);

      g.append('line')
        .attr('x1', xScale(p1.cylinder))
        .attr('y1', yScale(p1.step))
        .attr('x2', xScale(p2.cylinder))
        .attr('y2', yScale(p2.step))
        .attr('stroke', isWrap ? 'var(--accent-amber)' : 'var(--primary-cyan)')
        .attr('stroke-width', isWrap ? 1.8 : 2.2)
        .attr('stroke-dasharray', isWrap ? '5,4' : 'none')
        .attr('marker-end', isWrap ? 'url(#arrow-wrap)' : 'url(#arrow-head)')
        .style('opacity', 0.85);

      if (isWrap) {
        // Label the wrap jump to explicitly clarify no requests are serviced on wrap
        const midX = (xScale(p1.cylinder) + xScale(p2.cylinder)) / 2;
        const midY = (yScale(p1.step) + yScale(p2.step)) / 2;
        g.append('text')
          .attr('x', midX)
          .attr('y', midY - 6)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--accent-amber)')
          .attr('font-size', '9px')
          .attr('font-weight', '700')
          .text('Wrap Reset (No Service)');
      }
    }

    // Draw point markers
    visiblePoints.forEach((p, idx) => {
      const isStart = idx === 0;
      const isCurrentHead = idx === currentStep;

      const circle = g.append('circle')
        .attr('cx', xScale(p.cylinder))
        .attr('cy', yScale(p.step))
        .attr('r', isCurrentHead ? 6 : isStart ? 5 : 4)
        .attr('fill', isCurrentHead ? '#ffffff' : isStart ? 'var(--accent-purple)' : 'var(--primary-cyan)')
        .attr('stroke', isCurrentHead ? 'var(--primary-cyan)' : '#070a12')
        .attr('stroke-width', 2)
        .attr('cursor', 'pointer')
        .style('filter', isCurrentHead ? 'drop-shadow(0 0 8px rgba(0,242,254,0.8))' : 'none');

      circle.on('click', () => setSelectedPoint(p));

      // Point label
      g.append('text')
        .attr('x', xScale(p.cylinder))
        .attr('y', yScale(p.step) + (p.cylinder > maxCylinder - 25 ? -10 : 16))
        .attr('text-anchor', xScale(p.cylinder) > innerWidth - 40 ? 'end' : xScale(p.cylinder) < 40 ? 'start' : 'middle')
        .attr('fill', isCurrentHead ? '#ffffff' : 'var(--text-subtle)')
        .attr('font-size', '10px')
        .attr('font-weight', isCurrentHead ? '700' : '500')
        .text(p.cylinder);
    });

  }, [trajectoryPoints, currentStep, isEmpty, maxCylinder, maxSteps, policy]);

  // D3 Rendering: Cumulative Seek-Distance Chart
  useEffect(() => {
    if (!cumulativeSvgRef.current || isEmpty) return;

    const svg = d3.select(cumulativeSvgRef.current);
    const width = 640;
    const height = 150;
    const margin = { top: 20, right: 30, bottom: 30, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.selectAll('*').remove();

    // Standard compare-run aligned domain: up to 700 cylinders (covers textbook FCFS 640)
    const maxSeekLimit = Math.max(700, d3.max(trajectoryPoints, d => d.cumulativeSeek) || 640);

    const xScale = d3.scaleLinear()
      .domain([0, Math.max(1, maxSteps)])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, maxSeekLimit])
      .range([innerHeight, 0]);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid lines
    g.append('g')
      .call(
        d3.axisLeft(yScale)
          .ticks(4)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .call(gAxis => gAxis.select('.domain').remove())
      .call(gAxis => gAxis.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.05)'));

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(Math.min(8, maxSteps)).tickFormat(d => `Step ${d}`))
      .call(gAxis => gAxis.select('.domain').attr('stroke', 'var(--border-subtle)'))
      .call(gAxis => gAxis.selectAll('text').attr('fill', 'var(--text-subtle)').attr('font-size', '9px'))
      .call(gAxis => gAxis.selectAll('line').attr('stroke', 'var(--border-subtle)'));

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4).tickFormat(d => `${d} cyl`))
      .call(gAxis => gAxis.select('.domain').attr('stroke', 'var(--border-subtle)'))
      .call(gAxis => gAxis.selectAll('text').attr('fill', 'var(--text-subtle)').attr('font-size', '9px'))
      .call(gAxis => gAxis.selectAll('line').attr('stroke', 'var(--border-subtle)'));

    // Line generator
    const lineGen = d3.line<TrajectoryPoint>()
      .x(d => xScale(d.step))
      .y(d => yScale(d.cumulativeSeek))
      .curve(d3.curveLinear);

    // Area generator for gradient fill
    const areaGen = d3.area<TrajectoryPoint>()
      .x(d => xScale(d.step))
      .y0(innerHeight)
      .y1(d => yScale(d.cumulativeSeek))
      .curve(d3.curveLinear);

    const visiblePoints = trajectoryPoints.slice(0, currentStep + 1);

    if (visiblePoints.length > 0) {
      // Area fill
      g.append('path')
        .datum(visiblePoints)
        .attr('fill', 'rgba(0, 242, 254, 0.12)')
        .attr('d', areaGen);

      // Seek line
      g.append('path')
        .datum(visiblePoints)
        .attr('fill', 'none')
        .attr('stroke', 'var(--primary-cyan)')
        .attr('stroke-width', 2)
        .attr('d', lineGen);

      // Latest seek dot
      const latest = visiblePoints[visiblePoints.length - 1];
      g.append('circle')
        .attr('cx', xScale(latest.step))
        .attr('cy', yScale(latest.cumulativeSeek))
        .attr('r', 4.5)
        .attr('fill', 'var(--accent-emerald)')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);
    }

  }, [trajectoryPoints, currentStep, isEmpty, maxSteps]);

  // If empty queue state
  if (isEmpty) {
    return (
      <div
        data-testid="disk-empty-queue"
        className="glass-panel"
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12
        }}
      >
        <AlertCircle size={32} color="var(--text-subtle)" />
        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>No Disk Requests in Queue</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 450 }}>
          The I/O request queue is currently empty. Load the Silberschatz textbook preset or enter cylinder numbers to plot head trajectories.
        </p>
      </div>
    );
  }

  const activePoint = trajectoryPoints[currentStep] || trajectoryPoints[0];

  return (
    <div
      className="glass-panel"
      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}
      role="region"
      aria-label="Disk Head Trajectory and Seek Distance Chart"
    >
      {/* Header with Title and Policy */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <HardDrive size={18} color="var(--primary-cyan)" />
            Disk Head Cylinder Trajectory & Seek Chart
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: 2 }}>
            Animated head motion across cylinder space [0..{maxCylinder}], with cumulative seek distance from engine response.
          </p>
        </div>

        {/* Stepper / Animation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { setCurrentStep(0); setIsPlaying(false); }}
            className="btn-secondary"
            title="Reset to start"
            aria-label="Reset head to initial cylinder"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className="btn-secondary"
            title="Previous step"
            aria-label="Step back"
          >
            <SkipBack size={14} />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="btn-primary"
            style={{ minWidth: 90, justifyContent: 'center' }}
            aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span style={{ marginLeft: 4 }}>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            onClick={() => setCurrentStep(prev => Math.min(maxSteps, prev + 1))}
            disabled={currentStep === maxSteps}
            className="btn-secondary"
            title="Next step"
            aria-label="Step forward"
          >
            <SkipForward size={14} />
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px'
      }}>
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'block' }}>Algorithm:</span>
          <span className="badge badge-purple mono-val" style={{ fontSize: '0.82rem' }}>{policy} ({direction})</span>
        </div>
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'block' }}>Current Head:</span>
          <span className="mono-val" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-cyan)' }}>
            Cylinder {activePoint.cylinder}
          </span>
        </div>
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'block' }}>Step Progress:</span>
          <span className="mono-val" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
            {currentStep} / {maxSteps}
          </span>
        </div>
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'block' }}>Cumulative Seek:</span>
          <span className="mono-val" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
            {activePoint.cumulativeSeek} cyl
          </span>
        </div>
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'block' }}>Total Final Seek:</span>
          <span className="mono-val" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {simResult?.totalSeekDistance ?? 0} cyl
          </span>
        </div>
      </div>

      {/* Trajectory SVG Plot */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-subtle)' }}>
            Cylinder Space Trajectory (0 → {maxCylinder})
          </span>
          {policy === 'C-SCAN' && (
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', fontWeight: 600 }}>
              C-SCAN: Dashed amber line represents wrap return to 0 (no service)
            </span>
          )}
        </div>
        <svg
          ref={trajectorySvgRef}
          width={640}
          height={300}
          viewBox="0 0 640 300"
          style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
        />
      </div>

      {/* Cumulative Seek Distance Sparkline / Area Chart */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={13} color="var(--accent-emerald)" />
            Cumulative Seek Distance Over Time (Compare-Run Aligned)
          </span>
          <span className="mono-val" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Current: {activePoint.cumulativeSeek} / Max: {simResult?.totalSeekDistance}
          </span>
        </div>
        <svg
          ref={cumulativeSvgRef}
          width={640}
          height={150}
          viewBox="0 0 640 150"
          style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
        />
      </div>

      {/* Point Inspector */}
      {selectedPoint && (
        <div style={{
          fontSize: '0.75rem',
          padding: '8px 14px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <Info size={14} color="var(--primary-cyan)" />
          <span>
            Step {selectedPoint.step}: Cylinder <strong>{selectedPoint.cylinder}</strong> | Seek Distance: <strong>{selectedPoint.seekDistance} cyl</strong> | Accumulated: <strong>{selectedPoint.cumulativeSeek} cyl</strong>
            {selectedPoint.isWrapJump && <span style={{ color: 'var(--accent-amber)', marginLeft: 8 }}>[Wrap-Around Jump]</span>}
          </span>
        </div>
      )}
    </div>
  );
};

export default DiskHeadChart;
