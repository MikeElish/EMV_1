import { AbsoluteFill, useCurrentFrame } from "remotion";
import { IndustrialBackdrop, Sparks, SceneLabel, ZoomWrap, useSlowZoom } from "./shared";

export function ManufacturingScene() {
  const frame = useCurrentFrame();
  const scale = useSlowZoom();
  const spin = frame * 26;
  const toolX = 1180 + Math.sin(frame / 9) * 6;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0d12" }}>
      <IndustrialBackdrop top="#241a14" bottom="#0a0c12" />
      <ZoomWrap scale={scale}>
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          {/* lathe bed */}
          <rect x={520} y={640} width={900} height={40} fill="#3a3f4d" />
          <rect x={520} y={680} width={900} height={16} fill="#22262e" />
          {/* headstock */}
          <rect x={520} y={520} width={140} height={140} rx={10} fill="#4a5162" />
          {/* chuck */}
          <circle cx={700} cy={590} r={54} fill="#6b7280" />
          <circle cx={700} cy={590} r={30} fill="#3a3f4d" />
          {/* workpiece, spinning */}
          <g transform={`translate(700,590)`}>
            <g transform={`rotate(${spin})`}>
              <rect x={0} y={-14} width={340} height={28} fill="#c8cdd6" />
              <rect x={0} y={-14} width={340} height={6} fill="#eef1f5" opacity={0.6} />
            </g>
          </g>
          {/* tool post + cutting bit */}
          <rect x={toolX} y={560} width={16} height={60} fill="#20242c" />
          <rect x={toolX - 6} y={614} width={28} height={14} fill="#9aa2b1" />

          <Sparks x={toolX + 4} y={624} active />

          <SceneLabel eyebrow="Производство" title="Изготовление запчастей" />
        </svg>
      </ZoomWrap>
    </AbsoluteFill>
  );
}
