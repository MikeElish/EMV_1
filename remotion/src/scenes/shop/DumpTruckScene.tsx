import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IndustrialBackdrop, Sparks, SceneLabel, ZoomWrap, useSlowZoom } from "./shared";
import { Mechanic } from "./Mechanic";

export function DumpTruckScene() {
  const frame = useCurrentFrame();
  const scale = useSlowZoom();
  const bedTilt = interpolate(Math.sin(frame / 18), [-1, 1], [0, -14]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0d12" }}>
      <IndustrialBackdrop top="#181c22" bottom="#0a0c12" />
      <ZoomWrap scale={scale}>
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <rect x={0} y={900} width={1920} height={180} fill="#14161c" />

          <g transform="translate(760,560)">
            {/* cab */}
            <rect x={-40} y={100} width={140} height={160} rx={12} fill="#3f6ea5" />
            <rect x={-24} y={120} width={70} height={70} rx={8} fill="#cfe4f8" opacity={0.85} />
            {/* chassis */}
            <rect x={-60} y={240} width={560} height={40} fill="#2a3140" />
            {/* dump bed, pivoting up at the back */}
            <g transform="translate(160,240)">
              <g transform={`rotate(${bedTilt})`}>
                <path d="M0,0 L360,0 L340,-140 L20,-140 Z" fill="#e8a22a" />
                <path d="M0,0 L360,0 L360,16 L0,16 Z" fill="#c98b1f" />
              </g>
              {/* hydraulic ram */}
              <rect x={60} y={-10} width={18} height={90} fill="#9aa2b1" transform={`rotate(${bedTilt / 2})`} />
            </g>
            {/* wheels */}
            <circle cx={40} cy={300} r={46} fill="#20242c" />
            <circle cx={40} cy={300} r={20} fill="#6b7280" />
            <circle cx={300} cy={300} r={46} fill="#20242c" />
            <circle cx={300} cy={300} r={20} fill="#6b7280" />
            <circle cx={400} cy={300} r={46} fill="#20242c" />
            <circle cx={400} cy={300} r={20} fill="#6b7280" />
          </g>

          <Mechanic x={480} y={640} scale={1.15} />
          <Sparks x={540} y={760} active={frame % 42 < 22} />

          <SceneLabel eyebrow="Сервис" title="Ремонт самосвала" />
        </svg>
      </ZoomWrap>
    </AbsoluteFill>
  );
}
