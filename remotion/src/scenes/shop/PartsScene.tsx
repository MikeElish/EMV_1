import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  IndustrialBackdrop,
  GearIcon,
  SceneLabel,
  ZoomWrap,
  useSlowZoom,
} from "./shared";

const BOLTS = [
  { x: 300, y: 760, r: 16 },
  { x: 360, y: 800, r: 12 },
  { x: 250, y: 820, r: 10 },
  { x: 1500, y: 780, r: 14 },
  { x: 1560, y: 820, r: 11 },
];

export function PartsScene() {
  const frame = useCurrentFrame();
  const scale = useSlowZoom();
  const drop = interpolate(frame, [0, 20], [-40, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0d12" }}>
      <IndustrialBackdrop top="#1a2130" bottom="#0a0c12" />
      <ZoomWrap scale={scale}>
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          {/* shelf */}
          <rect x={140} y={840} width={1640} height={18} fill="#3a3f4d" />
          <rect x={140} y={858} width={1640} height={10} fill="#22262e" />

          {/* large hero gear + smaller mesh gear */}
          <g transform={`translate(960,520) translate(0,${drop})`}>
            <GearIcon x={0} y={0} r={140} color="#ff9d3d" speed={0.6} />
            <GearIcon x={210} y={90} r={70} color="#c8cdd6" speed={-1.1} />
          </g>

          {/* filter cylinders */}
          <g transform={`translate(0,${drop})`}>
            <rect x={640} y={660} width={90} height={170} rx={14} fill="#3f6ea5" />
            <rect x={640} y={660} width={90} height={26} rx={13} fill="#7fa8d8" />
            <rect x={1180} y={640} width={100} height={190} rx={16} fill="#c94f3a" />
            <rect x={1180} y={640} width={100} height={28} rx={14} fill="#e07a63" />
          </g>

          {/* bolts scattered on shelf */}
          <g transform={`translate(0,${drop})`}>
            {BOLTS.map((b, i) => (
              <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="#9aa2b1" stroke="#4c525f" strokeWidth={3} />
            ))}
          </g>

          <SceneLabel eyebrow="Каталог" title="Запчасти для спецтехники" />
        </svg>
      </ZoomWrap>
    </AbsoluteFill>
  );
}
