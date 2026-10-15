import React, { useEffect, useRef, useState } from 'react';

// ============================================================================
// 1. INTERFACES & EXPORTED TYPES
// ============================================================================

export interface HalftonePalette {
  background?: string;
  ink: string;
  warm: string;
}

export interface FooterLink {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface HalftonePreset {
  name: string;
  palette: HalftonePalette;
  gridStep?: number;
  dotSize?: number;
}

export interface HalftoneWordmarkFooterProps {
  wordmark?: string;
  label?: string;
  meta?: string;
  columns?: FooterColumn[];
  palette?: HalftonePalette;
  height?: string | number;
  className?: string;
  reducedMotion?: boolean;
}

// ============================================================================
// 2. PURE MATH HELPER FUNCTIONS
// ============================================================================

/**
 * Parses a hex color string into [r, g, b] integer components.
 */
export function hwfHex(hex: string): [number, number, number] {
  if (!hex || hex === 'transparent') {
    return [226, 232, 240]; // Fallback to #E2E8F0
  }
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return [r, g, b];
  }
  const num = parseInt(clean, 16) || 0;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Calculates dot radius based on density [0, 1] and max radius cap.
 */
export function hwfRadius(density: number, maxRadius: number): number {
  return Math.max(0, Math.min(maxRadius, density * maxRadius));
}

/**
 * GLSL-style step function: returns 0 if x < edge, otherwise 1.
 */
export function hwfStep(edge: number, x: number): number {
  return x < edge ? 0 : 1;
}

/**
 * Calculates a non-linear warmth factor [0, 1] based on distance to cursor.
 */
export function hwfWarmth(dist: number, maxDist: number): number {
  if (maxDist <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - dist / maxDist));
}

/**
 * Calculates adaptive font size so the wordmark fits cleanly within container width.
 */
export function hwfFitSize(width: number, wordLength: number, defaultSize: number): number {
  if (wordLength <= 0 || width <= 0) return defaultSize;
  const estimatedCharWidth = defaultSize * 0.58;
  const totalEstimated = wordLength * estimatedCharWidth;
  if (totalEstimated > width * 0.88) {
    return Math.floor((width * 0.88) / (wordLength * 0.58));
  }
  return defaultSize;
}

// ============================================================================
// 3. INTERNAL PARTICLE & SHOCKWAVE TYPES
// ============================================================================

interface HalftoneDot {
  hx: number;
  hy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseR: number;
  density: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  thickness: number;
  strength: number;
  speed: number;
}

// ============================================================================
// 4. TAILORED DEFAULTS FOR KERNELLENS
// ============================================================================

const DEFAULT_PALETTE: HalftonePalette = {
  background: 'transparent',
  ink: '#E2E8F0',
  warm: '#C2402A'
};

// ============================================================================
// 5. STREAMLINED COMPONENT IMPLEMENTATION (CANVAS ONLY)
// ============================================================================

export const HalftoneWordmarkFooter: React.FC<HalftoneWordmarkFooterProps> = ({
  wordmark = 'kernellens',
  palette = DEFAULT_PALETTE,
  height = '420px',
  className = '',
  reducedMotion = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  // State for active reduced-motion detection
  const [isReduced, setIsReduced] = useState<boolean>(reducedMotion);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReduced(reducedMotion || mediaQuery.matches);

    const onChange = (e: MediaQueryListEvent) => {
      setIsReduced(reducedMotion || e.matches);
    };
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let dots: HalftoneDot[] = [];
    const shockwaves: Shockwave[] = [];

    let pointerX = -9999;
    let pointerY = -9999;
    let pointerActive = false;

    const inkRgb = hwfHex(palette.ink);
    const warmRgb = hwfHex(palette.warm);

    // Initialize or rebuild dots based on canvas dimensions and wordmark
    const buildDots = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(rect.width * dpr);
      const heightPx = Math.floor(rect.height * dpr);

      if (width === 0 || heightPx === 0) return;

      canvas.width = width;
      canvas.height = heightPx;

      // Offscreen canvas for wordmark rasterization
      const offCanvas = document.createElement('canvas');
      offCanvas.width = width;
      offCanvas.height = heightPx;
      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return;

      const fittedFontSize = hwfFitSize(width, wordmark.length, Math.floor(heightPx * 0.45));

      offCtx.fillStyle = '#000000';
      offCtx.fillRect(0, 0, width, heightPx);
      offCtx.fillStyle = '#ffffff';
      offCtx.font = `900 ${fittedFontSize}px "Inter", "JetBrains Mono", system-ui, sans-serif`;
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';
      offCtx.letterSpacing = '0.04em';
      // Center wordmark vertically in the decluttered footer
      offCtx.fillText(wordmark.toLowerCase(), width / 2, heightPx * 0.5);

      const imgData = offCtx.getImageData(0, 0, width, heightPx);
      const data = imgData.data;

      const step = Math.max(10, Math.floor(12 * dpr));
      const newDots: HalftoneDot[] = [];

      for (let y = step / 2; y < heightPx; y += step) {
        for (let x = step / 2; x < width; x += step) {
          const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
          const brightness = data[idx] / 255;

          let baseR = 0;
          let density = 0;
          if (brightness > 0.08) {
            density = brightness;
            baseR = hwfRadius(brightness, 4.2 * dpr);
          } else {
            // Subtle ambient background matrix
            density = 0.06;
            baseR = 0.9 * dpr;
          }

          newDots.push({
            hx: x,
            hy: y,
            x,
            y,
            vx: 0,
            vy: 0,
            baseR,
            density
          });
        }
      }

      dots = newDots;
    };

    buildDots();

    // ResizeObserver for reliable dimension tracking
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => {
        buildDots();
      });
      ro.observe(containerRef.current);
    }

    const handleResize = () => {
      buildDots();
    };
    window.addEventListener('resize', handleResize);

    // Pointer events on canvas
    const handlePointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      pointerX = (e.clientX - rect.left) * dpr;
      pointerY = (e.clientY - rect.top) * dpr;
      pointerActive = true;
    };

    const handlePointerLeave = () => {
      pointerActive = false;
      pointerX = -9999;
      pointerY = -9999;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cx = (e.clientX - rect.left) * dpr;
      const cy = (e.clientY - rect.top) * dpr;

      // Trigger radiating click-shockwave ring
      shockwaves.push({
        x: cx,
        y: cy,
        radius: 0,
        maxRadius: 240 * dpr,
        thickness: 35 * dpr,
        strength: 16 * dpr,
        speed: 7 * dpr
      });
    };

    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('mouseleave', handlePointerLeave);
    canvas.addEventListener('click', handleClick);

    // Animation & Physics Loop
    let animationId: number;

    const render = () => {
      const width = canvas.width;
      const heightPx = canvas.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Transparent clear without solid fills to maintain WebGL plasma shader visibility
      ctx.clearRect(0, 0, width, heightPx);

      // Advance shockwaves
      for (let s = shockwaves.length - 1; s >= 0; s--) {
        const sw = shockwaves[s];
        sw.radius += sw.speed;
        if (sw.radius > sw.maxRadius) {
          shockwaves.splice(s, 1);
        }
      }

      const springK = 0.08;
      const damping = 0.84;
      const pushRadius = 85 * dpr;
      const pushStrength = 9 * dpr;

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];

        if (isReduced) {
          // In reduced motion mode, pin dots directly to resting coordinates
          d.x = d.hx;
          d.y = d.hy;
          d.vx = 0;
          d.vy = 0;
        } else {
          // 1. Pointer repulsion
          if (pointerActive) {
            const dx = d.x - pointerX;
            const dy = d.y - pointerY;
            const distSq = dx * dx + dy * dy;
            if (distSq < pushRadius * pushRadius && distSq > 0.1) {
              const dist = Math.sqrt(distSq);
              const push = (1 - dist / pushRadius) * pushStrength;
              d.vx += (dx / dist) * push;
              d.vy += (dy / dist) * push;
            }
          }

          // 2. Shockwave radial impulses
          for (let s = 0; s < shockwaves.length; s++) {
            const sw = shockwaves[s];
            const sdx = d.x - sw.x;
            const sdy = d.y - sw.y;
            const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
            const diff = Math.abs(sdist - sw.radius);
            if (diff < sw.thickness) {
              const factor = (1 - diff / sw.thickness) * (1 - sw.radius / sw.maxRadius);
              const impulse = factor * sw.strength;
              if (sdist > 0.01) {
                d.vx += (sdx / sdist) * impulse;
                d.vy += (sdy / sdist) * impulse;
              }
            }
          }

          // 3. Spring physics back to resting position
          const fx = (d.hx - d.x) * springK;
          const fy = (d.hy - d.y) * springK;
          d.vx = (d.vx + fx) * damping;
          d.vy = (d.vy + fy) * damping;

          d.x += d.vx;
          d.y += d.vy;
        }

        // Color & Warmth interpolation
        const distToCursor = Math.hypot(d.x - pointerX, d.y - pointerY);
        const warmth = hwfWarmth(distToCursor, 130 * dpr);

        const r = Math.round(inkRgb[0] + (warmRgb[0] - inkRgb[0]) * warmth);
        const g = Math.round(inkRgb[1] + (warmRgb[1] - inkRgb[1]) * warmth);
        const b = Math.round(inkRgb[2] + (warmRgb[2] - inkRgb[2]) * warmth);

        const alpha = d.density > 0.1 ? 0.75 + warmth * 0.25 : 0.22;

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

        ctx.beginPath();
        ctx.arc(d.x, d.y, Math.max(0.6, d.baseR + warmth * 1.5 * dpr), 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handlePointerMove);
      canvas.removeEventListener('mouseleave', handlePointerLeave);
      canvas.removeEventListener('click', handleClick);
    };
  }, [wordmark, palette, isReduced]);

  return (
    <footer
      ref={containerRef}
      className={`hwf-root relative z-10 w-full mt-auto ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        minHeight: typeof height === 'number' ? `${height}px` : height,
        marginTop: 'auto',
        background: 'transparent',
        overflow: 'hidden',
        pointerEvents: 'auto'
      }}
    >
      {/* Screen-reader-only accessible label */}
      <span
        className="hwf-sr"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: '0'
        }}
      >
        {wordmark}
      </span>

      {/* Primary interactive 2D halftone dot wordmark canvas */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: 'crosshair'
        }}
        aria-hidden="true"
        title="Halftone Wordmark (Hover to displace, Click to emit shockwave)"
      />
    </footer>
  );
};

export default HalftoneWordmarkFooter;
