import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IndustrialBackdrop, SceneLabel, ZoomWrap, useSlowZoom } from "./shared";
import { Mechanic } from "./Mechanic";

const CONTAINER_COLORS = ["#c94f3a", "#3f6ea5", "#e8a22a", "#4c8c5a"];

export function ReachStackerScene() {
  const frame = useCurrentFrame();
  const scale = useSlowZoom();
  const lift = interpolate(Math.sin(frame / 20), [-1, 1], [0, 40]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0d12" }}>
      <IndustrialBackdrop top="#0f1620" bottom="#0a0c12" />
      <ZoomWrap scale={scale}>
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <rect x={0} y={900} width={1920} height={180} fill="#0c1016" />

          {/* stacked shipping containers, background */}
          {CONTAINER_COLORS.map((c, i) => (
            <g key={i}>
              <rect x={120 + i * 130} y={700} width={110} height={200} fill={c} opacity={0.85} />
              <rect x={120 + i * 130} y={560} width={110} height={130} fill={c} opacity={0.6} />
            </g>
          ))}
          {CONTAINER_COLORS.map((c, i) => (
            <rect key={`r-${i}`} x={1500 + i * 100} y={760} width={90} height={140} fill={c} opacity={0.7} />
          ))}

          {/* reach stacker body */}
          <g transform="translate(760,900)">
            <rect x={-40} y={-60} width={260} height={60} rx={10} fill="#2a2f38" />
            <circle cx={20} cy={0} r={42} fill="#20242c" />
            <circle cx={180} cy={0} r={42} fill="#20242c" />
            <rect x={0} y={-220} width={140} height={160} rx={12} fill="#f5c518" />
            <rect x={16} y={-200} width={70} height={70} rx={8} fill="#1c2430" opacity={0.85} />

            {/* telescopic boom rising diagonally, spreader lifting a container */}
            <g transform="translate(120,-200) rotate(-52)">
              <rect x={0} y={-16} width={420} height={32} rx={8} fill="#e8a22a" />
              <rect x={0} y={-16} width={420 * 0.7} height={32} rx={8} fill="#f0b840" />
            </g>
            <g transform={`translate(${120 + 330 * 0.94},${-200 - 330 * 1.28 - lift})`}>
              <rect x={-16} y={-10} width={140} height={16} fill="#4c5666" />
              <rect x={-10} y={4} width={128} height={64} fill="#3f6ea5" />
            </g>
          </g>

          <Mechanic x={1180} y={780} scale={1.2} />

          <SceneLabel eyebrow="Сервис" title={"Ремонт ричстакера"} />
        </svg>
      </ZoomWrap>
    </AbsoluteFill>
  );
}
