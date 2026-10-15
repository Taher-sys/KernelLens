KernelLens Design System Specification: "Mission Control" (docs/ux-system.md)This specification defines the visual language, technical information hierarchy, and D3 visualization grammar for KernelLens. The interface balances high information density with immediate perceptual clarity: dark, matte, engineered, and mathematically rigorous.It explicitly rejects decorative "futuristic" AI tropes—no diffuse glassmorphism blurs, floating ambient gradients, neon bloom filters, or rounded decorative cards. Every pixel, line weight, and color value serves a technical diagnostic purpose.1. Design Tokens1.1 Canvas, Surface & Structural ColorsThe palette uses calibrated neutral carbon surfaces layered by functional z-index, using solid opaque tones and sharp 1px borders rather than blurred drop shadows.CSS/* Base Canvas & Surfaces */
--surface-canvas:      #0b0d10; /* Deepest background; root container */
--surface-panel:       #12151a; /* Structural modules, timeline bars, toolbars */
--surface-subpanel:    #181d24; /* Row backgrounds, nested containers, headers */
--surface-hover:       #1f252e; /* Interactive hover rows & selectable items */
--surface-active:      #262d38; /* Selected state / scrubhead hit targets */

/* Borders & Separators */
--border-subtle:       #1f242d; /* Structural division between panels */
--border-strong:       #2d3542; /* Container boundaries, axis rules */
--border-contrast:     #434f63; /* Focus rings, target reticles, active bounds */

/* Data Grids & Crosshairs */
--grid-line:           #161a22; /* D3 coordinate systems & ticks */
--grid-line-major:     #212733; /* Interval boundaries (e.g., quantum ticks) */
1.2 Monochromatic Typography ScaleA restrained mono/sans split: JetBrains Mono handles all metrics, data values, scales, and state labels; Inter handles interface chrome and structural labels.CSS/* Font Families */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

/* Type Scale (Dense, low-contrast hierarchy) */
--text-title:     16px / 20px --font-sans;  /* Panel headers, run ID titles */
--text-ui-bold:   13px / 16px --font-sans;  /* Column headers, control labels */
--text-ui:        13px / 16px --font-sans;  /* Descriptions, tooltips */
--text-data:      12px / 16px --font-mono;  /* Table rows, axis scales, Gantt bars */
--text-badge:     11px / 14px --font-mono;  /* State badges, chip labels, PIDs */
--text-micro:     10px / 12px --font-mono;  /* Tick marks, memory offsets, subtle labels */
1.3 Spacing, Borders, and RadiiCSS/* Spacing Scale (4px baseline grid) */
--space-1: 2px;
--space-2: 4px;
--space-3: 8px;
--space-4: 12px;
--space-5: 16px;
--space-6: 24px;

/* Structural Geometry */
--radius-none: 0px;  /* Canvas, charts, Gantt bars, page frames */
--radius-sm:   2px;  /* Micro buttons, state tags, status chips */
--radius-md:   3px;  /* Control buttons, text fields, top-level containers */
/* Radii above 4px are strictly prohibited to maintain an instrumentation feel. */
2. Semantic Color Systems2.1 Process State Taxonomy (CPU Subsystem)Process colors are distinct in both hue and luminance, tested against deuteranopia, protanopia, and tritanopia.StatePrimary HexPattern / Border FallbackFunctional MeaningNEW#4A5568Solid 1px dashed borderInitialized; awaiting admission to ready queueREADY#2B6CB0Solid Fill (#1A365D stroke)Enqueued in run queue; runnableRUNNING#00A389Solid High-Luminance FillActively consuming simulated CPU cyclesWAITING (I/O)#C05621Diagonal hatch pattern (45°)Blocked on asynchronous I/O completionBLOCKED (Sync)#C53030Cross-hatch patternBlocked on mutex, semaphore, or deadlockedTERMINATED#1A202COutline only (#718096 stroke)Completed execution; PCB preserved for accounting2.2 Memory & Cache Taxonomy (Virtual Memory Subsystem)TLB Hit: #38A169 (Solid jade border, 15% fill).TLB Miss: #D69E2E (Solid amber border, zero fill).Page Clean / Resident: #2D3748 (Slate fill, #718096 monospaced address).Page Modified / Dirty: #744210 (Umber fill, #D69E2E text, amber corner dog-ear indicator).Page Fault (Demand Load): #E53E3E (High-contrast red pulse line on timeline; red status band).Victim / Evicted Frame: Strikethrough text with #E53E3E 1px border highlight before dismissal.2.3 Concurrency & Deadlock TaxonomyResource Available: #285E61 (Deep teal border/fill).Resource Allocated: #2C5282 (Solid sapphire border/fill).Request Pending: #D69E2E (Dashed amber vector).Cycle Detected (Deadlock): #F56565 (100% saturation scarlet vector with animated SVG dash offset).3. Subsystem Visual Grammars3.1 CPU Replay: Multi-Lane SVG GanttGeometry: Rows represent processes (ProcessId), height fixed at $28\text{px}$ with a $4\text{px}$ gap. The bottom row is reserved for the CPU Core 0 master aggregate execution lane.Preemption & Quantum Transitions: Represented as sharp vertical line dividers (1px #0B0D10). Preemption points display a downward arrowhead marker ($3\text{px}$) on the top border.Context Switch Overhead: Rendered as narrow neutral gray blocks (#4A5568) filled with $45^\circ$ micro-stripes. Length corresponds precisely to the configured switch overhead ticks.Time Ruler (X-Axis): Pinned to the top of the chart. Major ticks represent quanta (e.g., every 5 ticks), labeled in JetBrains Mono 10px. Minor ticks represent 1 integer simulation tick.The Playhead (Scrubbed Time): A single vertical hairline (#00F2FE or #FFFFFF, $1\text{px}$) cutting through all lanes. The top anchor contains a reverse-triangle flag displaying T={now}.3.2 Virtual Memory: Frame Matrix & Reference Fault TapePhysical Frame Grid: Represented as a compact matrix of rectangular cells. Each cell contains:Top edge: Frame ID (F0, F1, ...) in text-micro.Center: Stored Page ID in bold text-data.Bottom edge: Reference/Dirty bits (R=1 D=0) or age counter.Fault Tape (Time-Series Reference Stream): A horizontal tape of referenced page numbers advancing past a fixed reader window.Hit: Green dot indicator underneath the frame number.Fault: Vertical red pill marker extending below the reference tape, dropping an animated connector line directly into the frame selected by the victim algorithm (FIFO, LRU, Clock, Optimal).Clock Algorithm Specifics: Frames are arranged in a regular polygon or circular track with an explicit vector "hand" pointing to the current candidate frame. When a reference bit resets, the indicator transitions from green (1) to gray (0) with a swift tick rotation.3.3 Concurrency: Resource Allocation Graph (RAG) & Banker MatricesRAG Nodes:Processes: Circular nodes ($24\text{px}$ diameter) labeled P0, P1.Resource Types: Rectangular containers ($28\text{px} \times 28\text{px}$) with internal dots representing multiple resource instances.Edges:Request Edge ($P_i \to R_j$): Directed path starting from process circumference terminating on resource outer boundary. Rendered with dashed style.Assignment Edge ($R_j \to P_i$): Directed solid path originating from a specific internal instance dot terminating at process edge.Deadlock Representation: When Tarjan’s/DFS identifies a cycle, non-participating nodes dim to 20% opacity. The cycle edges thicken to $2\text{px}$ #F56565 with a high-contrast animated march stroke.Banker's Algorithm Matrix Stepper: Three side-by-side technical data matrices (Allocation, Max, Need) flanked by a 1D vector (Available). During step execution:Rows meeting condition ($\text{Need}_i \le \text{Available}$) highlight in subtle green.Reclaimed resources visually tally into the Available vector with an incremental badge indicator (+Allocation_i).3.4 Disk Scheduling: Cylinder Track Vector PlotCoordinate Plane: Y-axis represents cylinder numbers ($0$ at top, $\text{MaxCylinder}$ at bottom). X-axis represents chronological request service sequence ($0, 1, 2, \dots, N$).Head Path: A continuous stepped polyline connecting cylinder requests.Standard seek: Solid blue line (#4299E1, $1.5\text{px}$).Non-servicing sweeps (e.g., C-SCAN return to cylinder 0): Dashed line (#A0AEC0, $1\text{px}$) to explicitly denote seek distance without read/write operations.Queue Cylinder Reticle: A dynamic vertical rail showing pending requests as circular tick marks on the cylinder axis. When the head arrives at a cylinder, the tick mark flashes white ($100\text{ms}$) and transitions to an outline ring.3.5 Comparative Analytics (A/B Run Overlays)Metrics Delta Board: Structured comparison grid featuring strict differential readouts:Positive outcome (e.g., lower average wait time): Value rendered in green text preceded by a down-delta (▼ -4.2 ticks).Degraded outcome (e.g., higher context switch count): Value rendered in warning amber with up-delta (▲ +12 switches).Dual Gantt Alignment: Policy A and Policy B Gantts share a single global x-axis and scrubber. Scrubbing the timeline scrubs both policies concurrently, highlighting divergences in real-time completion order and starvation gaps.4. Motion Mechanics & Animation ChoreographyAnimations exist solely to preserve spatial constancy and expose algorithmic causality. Decorative physics, bounce curves, and overshoot springs are forbidden.CSS/* Animation Curves & Timings */
--ease-standard: cubic-bezier(0.2, 0.0, 0.0, 1.0); /* Sharp acceleration, clean stop */
--duration-instant: 50ms;  /* Reticle snaps, micro-toggle changes */
--duration-fast:    120ms; /* Playhead stepping, cell updates, hover states */
--duration-state:   200ms; /* Frame allocation shifts, edge creations, row swaps */
--duration-sweep:   350ms; /* Full-range disk-head sweep, macro-scrub interpolations */
4.1 Reduced-Motion Mode (prefers-reduced-motion: reduce)Transitions: All CSS transitions and D3 duration tweens are set to 0ms.State Updates: Updates to Gantt charts, matrices, and memory frames occur through instant discrete re-renders (selection.attr() without .transition()).Edge Marching: Dashed animated cycle highlights in RAG are replaced by a solid high-contrast double border ($2\text{px}$ white outline + $2\text{px}$ scarlet fill).5. Control Ergonomics & Keyboard NavigationThe bottom docking area serves as the Master Simulation Deck:[ ⏮ Step Back ] [ ▶ Play / ⏸ Pause ] [ ⏭ Step Fwd ] | ━━━●━━━━━━━━━ 00:42 / 01:28 | Speed: [0.5x][1x][2x][Max] | Run: seed-42-cpu-rr
5.1 Keyboard Shortcuts MappingSpace: Toggle Play / Pause simulation.ArrowRight: Step forward 1 simulation tick.ArrowLeft: Step backward 1 simulation tick.Shift + ArrowRight: Jump to next major event (next preemption, fault, or lock state).Shift + ArrowLeft: Jump to previous major event.Home / End: Jump to tick 0 / Jump to simulation termination.1 – 4: Switch subsystem views (1: CPU, 2: VM, 3: Sync, 4: Disk).C: Toggle Policy Comparison split-pane.5.2 Focus Rings & A11yAll interactive SVG nodes (Gantt segments, frame cells, graph vertices) must be keyboard-focusable:CSS:focus-visible {
  outline: 2px solid var(--border-contrast);
  outline-offset: 1px;
}
6. Layout Density & Viewport RulesThe interface is optimized for desktop and laboratory workstation displays ($1920 \times 1080$ and $1440 \times 900$). Mobile viewports ($< 768\text{px}$) are treated as diagnostic monitors rather than full simulation canvases.Workstation/Desktop ($>1024\text{px}$):3-column layout: Left (Workload Builder & Presets, $280\text{px}$ fixed), Center (D3 Primary Canvas, flexible), Right (Live Metrics, Telemetry & Event Stream, $320\text{px}$ fixed).Bottom: Simulation Deck controller ($48\text{px}$ fixed height).Compact/Tablet ($768\text{px} - 1024\text{px}$):Workload Builder collapses to an off-canvas drawer.Center view remains unconstrained. Metrics table docks below the active D3 canvas.Mobile Diagnostic Fallback ($<768\text{px}$):Complex multi-lane Gantts and RAG force-directed graphs collapse into scrollable horizontal viewports with an explicit message: "Full interactive scrubbing optimized for desktop viewport."A condensed Event Log and Metric Delta Table take structural priority.7. Design Review & Anti-Pattern ChecklistUse this checklist to audit any view before committing code:[ ] Zero Glassmorphism: Are there any backdrop-filter: blur() properties? (If yes, remove; use solid opaque #12151A with a 1px border).[ ] No Uncalibrated Neon: Are glowing drop-shadows present on text or SVG paths? (If yes, remove; high-contrast flat fills only).[ ] Labeling Integrity: Does every axis, tick, and bar have unambiguous units (e.g., ticks, cylinders, frames)?[ ] Deterministic Scrubbing: Does moving the playhead to tick $T$ via slider render the identical SVG state as stepping forward frame-by-frame to tick $T$?[ ] Color-Blind Legibility: Are process states and memory statuses identifiable without relying strictly on green/red hues (e.g., hatch patterns, distinct label chips)?[ ] D3 Lifecycle Cleanliness: Do D3 transitions correctly bind to unique keys (pid, frame_id, cyl_id) to prevent DOM node reuse glitches during replay scrubbing?[ ] Restrained Radii: Are all corners $\le 3\text{px}$?8. Implementation Quick-Reference: React + D3 Integration PatternTo avoid DOM collisions between React's Virtual DOM and D3's imperative updates, all visualizations must follow this containment contract:TypeScriptimport React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const GanttChart: React.FC<{ events: SimEvent[]; currentTime: number }> = ({ events, currentTime }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // 1. Structural scaffold rendered strictly once by React
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    // Setup isolated groups for static axes vs dynamic entities
    svg.append('g').attr('class', 'grid-layer');
    svg.append('g').attr('class', 'bars-layer');
    svg.append('g').attr('class', 'playhead-layer');
  }, []);

  // 2. Dynamic event and time scrubbing driven strictly by D3 selection joins
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    // Update playhead without re-rendering parent container
    svg.select('.playhead-layer')
      .selectAll('.playhead-line')
      .data([currentTime])
      .join('line')
      .attr('class', 'playhead-line')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', 'var(--border-contrast)')
      .attr('stroke-width', 1);
  }, [events, currentTime]);

  return (
    <div className="w-full overflow-hidden bg-[var(--surface-panel)] border border-[var(--border-subtle)]">
      <svg ref={svgRef} className="w-full h-[320px] block" />
    </div>
  );
};