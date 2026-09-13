import type { CSSProperties, ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";

export const SCENE_FPS = 30;
export const SCENE_DURATION = 56; // ~1.87s per clip
export const TRANSITION_DURATION = 8;

// Slow, subtle push-in over the life of a scene -- gives static vector
// illustrations a bit of camera-like motion without being distracting.
export function useSlowZoom(from = 1, to = 1.08, duration = SCENE_DURATION) {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, duration], [from, to], {
    extrapolateRight: "clamp",
  });
}

export function IndustrialBackdrop({
  top,
  bottom,
}: {
  top: string;
  bottom: string;
}) {
  const frame = useCurrentFrame();
  const gridShift = (frame * 0.6) % 64;

  return (
    <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id="industrial-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
        <radialGradient id="industrial-vignette" cx="50%" cy="42%" r="75%">
          <stop offset="55%" stopColor="#000000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.55} />
        </radialGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#industrial-bg)" />
      <g opacity={0.09} stroke="#ffffff" strokeWidth={1}>
        {Array.from({ length: 30 }, (_, i) => (
          <line key={`v${i}`} x1={i * 64 - gridShift} y1={0} x2={i * 64 - gridShift} y2={1080} />
        ))}
        {Array.from({ length: 17 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 64} x2={1920} y2={i * 64} />
        ))}
      </g>
      <rect width="1920" height="1080" fill="url(#industrial-vignette)" />
    </svg>
  );
}

const SPARK_SEEDS = Array.from({ length: 14 }, (_, i) => ({
  angle: (i / 14) * Math.PI * 2 + (i % 3),
  speed: 3 + (i % 5) * 1.4,
  size: 2 + (i % 3),
  delay: (i * 5) % 18,
}));

export function Sparks({ x, y, active = true }: { x: number; y: number; active?: boolean }) {
  const frame = useCurrentFrame();
  if (!active) return null;
  return (
    <g>
      {SPARK_SEEDS.map((s, i) => {
        const t = ((frame - s.delay) % 26 + 26) % 26;
        const dist = t * s.speed;
        const px = x + Math.cos(s.angle) * dist;
        const py = y + Math.sin(s.angle) * dist - t * 1.6;
        const opacity = interpolate(t, [0, 4, 20, 26], [0, 1, 0.7, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={s.size}
            fill={i % 3 === 0 ? "#fff3c4" : "#ff9d3d"}
            opacity={opacity}
          />
        );
      })}
      <circle cx={x} cy={y} r={10} fill="#fff8e0" opacity={0.85} />
    </g>
  );
}

export function GearIcon({
  x,
  y,
  r,
  color,
  speed = 1,
}: {
  x: number;
  y: number;
  r: number;
  color: string;
  speed?: number;
}) {
  const frame = useCurrentFrame();
  const rot = frame * 4 * speed;
  const teeth = 10;
  const points: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a1 = (i / teeth) * Math.PI * 2;
    const a2 = a1 + (Math.PI * 2) / teeth / 2;
    points.push(`${Math.cos(a1) * r},${Math.sin(a1) * r}`);
    points.push(`${Math.cos(a1) * r * 1.22},${Math.sin(a1) * r * 1.22}`);
    points.push(`${Math.cos(a2) * r * 1.22},${Math.sin(a2) * r * 1.22}`);
    points.push(`${Math.cos(a2) * r},${Math.sin(a2) * r}`);
  }
  return (
    <g transform={`translate(${x},${y}) rotate(${rot})`} opacity={0.9}>
      <polygon points={points.join(" ")} fill={color} />
      <circle r={r * 0.42} fill="#12141a" />
    </g>
  );
}

export function SceneLabel({ eyebrow, title }: { eyebrow: string; title: string }) {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [4, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <g opacity={reveal} transform={`translate(${0}, ${(1 - reveal) * 16})`}>
      <rect x={70} y={900} width={54} height={6} fill="#ff9d3d" />
      <text x={70} y={946} fontFamily="Arial, sans-serif" fontWeight={700} fontSize={22} letterSpacing={4} fill="#ff9d3d">
        {eyebrow.toUpperCase()}
      </text>
      <text x={70} y={996} fontFamily="Arial, sans-serif" fontWeight={800} fontSize={52} fill="#f5f6f8">
        {title}
      </text>
    </g>
  );
}

export function ZoomWrap({ children, scale }: { children: ReactNode; scale: number }) {
  const style: CSSProperties = {
    position: "absolute",
    inset: 0,
    transform: `scale(${scale})`,
    transformOrigin: "50% 50%",
  };
  return <div style={style}>{children}</div>;
}
