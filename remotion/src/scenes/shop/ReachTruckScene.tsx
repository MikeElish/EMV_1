import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IndustrialBackdrop, SceneLabel, ZoomWrap, useSlowZoom } from "./shared";
import { Mechanic } from "./Mechanic";

const RACK_X = [140, 260, 380, 1480, 1600, 1720];

export function ReachTruckScene() {
  const frame = useCurrentFrame();
  const scale = useSlowZoom();
  const reachExtend = interpolate(Math.sin(frame / 14), [-1, 1], [0, 90]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0d12" }}>
      <IndustrialBackdrop top="#141a24" bottom="#0a0c12" />
      <ZoomWrap scale={scale}>
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <rect x={0} y={880} width={1920} height={200} fill="#14161c" />

          {/* warehouse racking silhouettes */}
          {RACK_X.map((x, i) => (
            <g key={i} opacity={0.5}>
              <rect x={x} y={280} width={18} height={600} fill="#232a36" />
              {[380, 500, 620, 740].map((y) => (
                <rect key={y} x={x - 30} y={y} width={78} height={12} fill="#2c3442" />
              ))}
            </g>
          ))}

          {/* reach truck body */}
          <g transform="translate(880,520)">
            <rect x={0} y={160} width={220} height={160} rx={14} fill="#3f6ea5" />
            <rect x={20} y={180} width={110} height={90} rx={8} fill="#cfe4f8" opacity={0.85} />
            {/* outrigger legs reaching forward */}
            <rect x={-260} y={280} width={280} height={20} fill="#25344a" />
            <rect x={-260} y={320} width={280} height={20} fill="#25344a" />
            {/* mast + reaching forks */}
            <rect x={-40} y={0} width={14} height={340} fill="#4c5666" />
            <g transform={`translate(${-40 - reachExtend},0)`}>
              <rect x={-160} y={300} width={200} height={16} fill="#ff9d3d" />
              <rect x={-160} y={326} width={200} height={16} fill="#ff9d3d" />
            </g>
            <circle cx={60} cy={340} r={40} fill="#20242c" />
            <circle cx={190} cy={340} r={40} fill="#20242c" />
          </g>

          <Mechanic x={1220} y={560} scale={1.1} />

          <SceneLabel eyebrow="Сервис" title="Ремонт рич-трака" />
        </svg>
      </ZoomWrap>
    </AbsoluteFill>
  );
}
