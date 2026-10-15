import React, { useState, MouseEvent as ReactMouseEvent } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'motion/react';
import { CanvasRevealEffect } from './canvas-reveal-effect';

export interface CardSpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  radius?: number;
  color?: string;
  revealColors?: number[][];
  className?: string;
  style?: React.CSSProperties;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  enableReveal?: boolean;
}

export const CardSpotlight: React.FC<CardSpotlightProps> = ({
  children,
  radius = 320,
  revealColors = [[59, 130, 246], [139, 92, 246]],
  className = '',
  style,
  contentClassName = '',
  contentStyle,
  enableReveal = true,
  ...props
}) => {
  const mouseX = useMotionValue(-9999);
  const mouseY = useMotionValue(-9999);
  const [isHovering, setIsHovering] = useState<boolean>(false);

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  };

  const handleMouseEnter = (e: ReactMouseEvent<HTMLDivElement>) => {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
    setIsHovering(true);
  };
  const handleMouseLeave = () => {
    setIsHovering(false);
    mouseX.set(-9999);
    mouseY.set(-9999);
  };

  const maskImage = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, white 0%, rgba(255, 255, 255, 0.4) 40%, transparent 80%)`;

  return (
    <div
      className={`group/spotlight relative overflow-hidden rounded-md border border-[#1F242D] bg-[#12151A]/60 backdrop-blur-sm transition-colors duration-300 ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        background: 'rgba(18, 21, 26, 0.60)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        border: '1px solid #1f242d',
        ...style
      }}
      {...props}
    >
      {/* Interactive procedural spotlight mask layer */}
      {enableReveal && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover/spotlight:opacity-100"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            maskImage,
            WebkitMaskImage: maskImage
          }}
          aria-hidden="true"
        >
          {isHovering && (
            <CanvasRevealEffect
              animationSpeed={2.5}
              colors={revealColors}
              dotSize={2}
              containerClassName="bg-transparent absolute inset-0 pointer-events-none"
            />
          )}
        </motion.div>
      )}

      {/* Primary child content with full pointer event access */}
      <div
        className={`relative z-20 h-full w-full pointer-events-auto ${contentClassName}`}
        style={{
          position: 'relative',
          zIndex: 20,
          pointerEvents: 'auto',
          width: '100%',
          height: '100%',
          ...contentStyle
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default CardSpotlight;
