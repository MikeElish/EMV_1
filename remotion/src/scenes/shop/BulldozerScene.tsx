import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IndustrialBackdrop, SceneLabel, ZoomWrap, useSlowZoom } from "./shared";
import { Mechanic } from "./Mechanic";

const DUST = Array.from({ length: 10 }, (_, i) => ({
  x: 420 + i * 22,
  seed: i,
}));

export function BulldozerScene() {
  const frame = useCurrentFrame();
  const scale = useSlowZoom();
  const bladeLift = interpolate(Math.sin(frame / 15), [-1, 1], [0, 24]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0d12" }}>
      <IndustrialBackdrop top="#201a12" bottom="#0a0c12" />
      <ZoomWrap scale={scale}>
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <rect x={0} y={900} width={1920} height={180} fill="#1a150e" />

          {DUST.map((d, i) => {
            const t = (frame + d.seed * 7) % 40;
            return (
              <circle
                key={i}
                cx={d.x - t * 3}
                cy={900 - t * 1.4}
                r={10 + t / 5}
                fill="#a8895c"
                opacity={interpolate(t, [0, 10, 40], [0, 0.35, 0])}
              />
            );
          })}

          <g transform="translate(820,700)">
            {/* tracks */}
            <rect x={-40} y={0} width={440} height={70} rx={30} fill="#2a2f38" />
            {/* body */}
            <rect x={40} y={-150} width={300} height={150} rx={14} fill="#c94f3a" />
            <rect x={60} y={-130} width={130} height={80} rx={8} fill="#1c2430" opacity={0.85} />
            {/* blade arms + blade, animated up/down */}
            <g transform={`translate(0,${-bladeLift})`}>
              <rect x={-260} y={-30} width={300} height={16} fill="#4c5666" />
              <path d="M-320,-90 L-260,-100 L-260,10 L-320,30 Z" fill="#e07a63" />
            </g>
          </g>

          <Mechanic x={1160} y={660} scale={1.15} />

          <SceneLabel eyebrow="Сервис" title="Ремонт бульдозера" />
        </svg>
      </ZoomWrap>
    </AbsoluteFill>
  );
}
