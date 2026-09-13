import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IndustrialBackdrop, Sparks, SceneLabel, ZoomWrap, useSlowZoom } from "./shared";
import { Mechanic } from "./Mechanic";

export function ForkliftScene() {
  const frame = useCurrentFrame();
  const scale = useSlowZoom();
  const forkLift = interpolate(Math.sin(frame / 12), [-1, 1], [0, 60]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0d12" }}>
      <IndustrialBackdrop top="#1a1f16" bottom="#0a0c12" />
      <ZoomWrap scale={scale}>
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <rect x={0} y={860} width={1920} height={220} fill="#14161c" />

          <g transform="translate(760,420)">
            {/* mast */}
            <rect x={0} y={0} width={16} height={420} fill="#3a3f4d" />
            <rect x={40} y={0} width={16} height={420} fill="#3a3f4d" />
            {/* forks, animated up/down */}
            <g transform={`translate(0,${420 - forkLift})`}>
              <rect x={-180} y={0} width={200} height={16} fill="#ff9d3d" />
              <rect x={-180} y={26} width={200} height={16} fill="#ff9d3d" />
              <rect x={0} y={-10} width={20} height={46} fill="#c8cdd6" />
            </g>
            {/* cab + counterweight body */}
            <rect x={56} y={140} width={260} height={220} rx={14} fill="#f5c518" />
            <rect x={80} y={160} width={150} height={110} rx={10} fill="#1c2430" opacity={0.85} />
            <rect x={250} y={280} width={100} height={90} rx={8} fill="#3a3f4d" />
            {/* wheels */}
            <circle cx={130} cy={380} r={46} fill="#20242c" />
            <circle cx={130} cy={380} r={20} fill="#6b7280" />
            <circle cx={330} cy={380} r={40} fill="#20242c" />
            <circle cx={330} cy={380} r={17} fill="#6b7280" />
          </g>

          <Mechanic x={1120} y={520} scale={1.15} />
          <Sparks x={1180} y={640} active={frame % 40 < 26} />

          <SceneLabel eyebrow="Сервис" title="Ремонт вилочного погрузчика" />
        </svg>
      </ZoomWrap>
    </AbsoluteFill>
  );
}
