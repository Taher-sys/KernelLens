import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface CanvasRevealEffectProps {
  animationSpeed?: number;
  opacities?: number[];
  colors?: number[][];
  containerClassName?: string;
  dotSize?: number;
  showGradient?: boolean;
}

export const CanvasRevealEffect: React.FC<CanvasRevealEffectProps> = ({
  animationSpeed = 0.4,
  opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],
  colors = [[59, 130, 246], [139, 92, 246]],
  containerClassName = '',
  dotSize = 2,
  showGradient = false
}) => {
  return (
    <div className={`h-full relative w-full overflow-hidden ${containerClassName}`}>
      <div className="h-full w-full">
        <DotMatrix
          colors={colors}
          dotSize={dotSize}
          opacities={opacities}
          shader={`
            float animation_speed_factor = ${animationSpeed.toFixed(2)};
            float intro_offset = distance(u_resolution / 2.0 / u_total_size, st2) * 0.01 + (random(st2) * 0.15);
            opacity *= step(intro_offset, u_time * animation_speed_factor);
            opacity *= clamp((1.0 - step(intro_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
          `}
          center={['x', 'y']}
        />
      </div>
      {showGradient && (
        <div className="absolute inset-0 bg-gradient-to-t from-[#12151A] to-transparent pointer-events-none" />
      )}
    </div>
  );
};

export interface DotMatrixProps {
  colors?: number[][];
  opacities?: number[];
  totalSize?: number;
  dotSize?: number;
  shader?: string;
  center?: ('x' | 'y')[];
}

export const DotMatrix: React.FC<DotMatrixProps> = ({
  colors = [[59, 130, 246], [139, 92, 246]],
  opacities = [0.08, 0.08, 0.12, 0.16, 0.22, 0.3, 0.4, 0.55, 0.75, 1.0],
  totalSize = 4,
  dotSize = 2,
  shader = '',
  center = ['x', 'y']
}) => {
  const uniforms = useMemo(() => {
    let colorsArray = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    if (colors.length === 1) {
      colorsArray = [colors[0], colors[0], colors[0], colors[0], colors[0], colors[0]];
    } else if (colors.length === 2) {
      colorsArray = [colors[0], colors[0], colors[0], colors[1], colors[1], colors[1]];
    } else if (colors.length >= 3) {
      colorsArray = [colors[0], colors[0], colors[1], colors[1], colors[2], colors[2]];
    }

    return {
      u_colors: {
        value: colorsArray.map((color) => [
          color[0] / 255,
          color[1] / 255,
          color[2] / 255
        ]),
        type: '3fv'
      },
      u_opacities: {
        value: opacities,
        type: '1fv'
      },
      u_total_size: {
        value: totalSize,
        type: 'f'
      },
      u_dot_size: {
        value: dotSize,
        type: 'f'
      }
    };
  }, [colors, opacities, totalSize, dotSize]);

  return (
    <Shader
      source={`
        precision mediump float;
        in vec2 fragCoord;

        uniform float u_time;
        uniform float u_opacities[10];
        uniform vec3 u_colors[6];
        uniform float u_total_size;
        uniform float u_dot_size;
        uniform vec2 u_resolution;
        out vec4 fragColor;

        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
          vec2 st = fragCoord.xy * u_resolution;
          ${
            center.includes('x')
              ? 'st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));'
              : ''
          }
          ${
            center.includes('y')
              ? 'st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));'
              : ''
          }
          float opacity = step(0.0, st.x) * step(0.0, st.y);

          vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

          float frequency = 4.0;
          float show_offset = random(st2);
          float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency) + 1.0);
          opacity *= u_opacities[int(rand * 10.0)];
          opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
          opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

          vec3 color = u_colors[int(show_offset * 6.0)];

          ${shader}

          fragColor = vec4(color, opacity);
          fragColor.rgb *= fragColor.a;
        }
      `}
      uniforms={uniforms}
      maxFps={60}
    />
  );
};

export interface ShaderProps {
  source: string;
  uniforms: {
    [key: string]: {
      value: number[] | number[][] | number;
      type: string;
    };
  };
  maxFps?: number;
}

export const ShaderMaterial: React.FC<{
  source: string;
  uniforms: {
    [key: string]: {
      value: number[] | number[][] | number;
      type: string;
    };
  };
  maxFps?: number;
}> = ({ source, uniforms, maxFps = 60 }) => {
  const { size } = useThree();
  const ref = useRef<THREE.Mesh>(null);
  const lastFrameTimeRef = useRef(0);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const timestamp = clock.getElapsedTime();
    if (timestamp - lastFrameTimeRef.current < 1 / maxFps) {
      return;
    }
    lastFrameTimeRef.current = timestamp;

    const material = ref.current.material as THREE.ShaderMaterial;
    if (material && material.uniforms) {
      if (material.uniforms.u_time) {
        material.uniforms.u_time.value = timestamp;
      }
      if (material.uniforms.u_resolution) {
        material.uniforms.u_resolution.value.set(size.width * 2, size.height * 2);
      }
    }
  });

  const preparedUniforms = useMemo(() => {
    const prep: Record<string, { value: any; type?: string }> = {};

    for (const uniformName in uniforms) {
      const uniform = uniforms[uniformName];

      switch (uniform.type) {
        case '1f':
          prep[uniformName] = { value: uniform.value, type: '1f' };
          break;
        case '3f':
          prep[uniformName] = {
            value: new THREE.Vector3().fromArray(uniform.value as number[]),
            type: '3f'
          };
          break;
        case '1fv':
          prep[uniformName] = { value: uniform.value, type: '1fv' };
          break;
        case '3fv':
          prep[uniformName] = {
            value: (uniform.value as number[][]).map((v: number[]) =>
              new THREE.Vector3().fromArray(v)
            ),
            type: '3fv'
          };
          break;
        case '2f':
          prep[uniformName] = {
            value: new THREE.Vector2().fromArray(uniform.value as number[]),
            type: '2f'
          };
          break;
        default:
          prep[uniformName] = { value: uniform.value };
          break;
      }
    }

    prep.u_time = { value: 0, type: '1f' };
    prep.u_resolution = {
      value: new THREE.Vector2(size.width * 2, size.height * 2)
    };

    return prep;
  }, [size.width, size.height, uniforms]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        precision mediump float;
        out vec2 fragCoord;
        void main() {
          fragCoord = (position.xy + vec2(1.0)) * 0.5;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: source,
      uniforms: preparedUniforms,
      glslVersion: THREE.GLSL3,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      transparent: true
    });
  }, [preparedUniforms, source]);

  return (
    <mesh ref={ref}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

export const Shader: React.FC<ShaderProps> = ({ source, uniforms, maxFps = 60 }) => {
  return (
    <Canvas
      className="absolute inset-0 h-full w-full pointer-events-none"
      gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <ShaderMaterial source={source} uniforms={uniforms} maxFps={maxFps} />
    </Canvas>
  );
};

export default CanvasRevealEffect;
