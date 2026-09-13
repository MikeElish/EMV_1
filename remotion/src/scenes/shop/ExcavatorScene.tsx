import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { IndustrialBackdrop, Sparks, SceneLabel, ZoomWrap, useSlowZoom } from "./shared";
import { Mechanic } from "./Mechanic";

export function ExcavatorScene() {
  const frame = useCurrentFrame();
  const scale = useSlowZoom();
  const boomAngle = interpolate(Math.sin(frame / 16), [-1, 1], [-6, 8]);
  const armAngle = interpolate(Math.sin(frame / 13), [-1, 1], [-10, 6]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0d12" }}>
      <IndustrialBackdrop top="#1c1912" bottom="#0a0c12" />
      <ZoomWrap scale={scale}>
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <rect x={0} y={900} width={1920} height={180} fill="#171410" />

          <g transform="translate(760,760)">
            {/* tracks */}
            <rect x={-40} y={0} width={420} height={70} rx={30} fill="#2a2f38" />
            <circle cx={0} cy={35} r={35} fill="#20242c" />
            <circle cx={340} cy={35} r={35} fill="#20242c" />
            {/* body */}
            <rect x={20} y={-140} width={280} height={140} rx={16} fill="#e8a22a" />
            <rect x={40} y={-120} width={130} height={80} rx={8} fill="#1c2430" opacity={0.85} />

            {/* boom */}
            <g transform={`translate(230,-90) rotate(${boomAngle})`}>
              <rect x={0} y={-16} width={260} height={30} rx={10} fill="#e8a22a" />
              <g transform={`translate(250,0) rotate(${armAngle})`}>
                <rect x={0} y={-14} width={190} height={26} rx={10} fill="#d99420" />
                <g transform="translate(180,10)">
                  <path d="M0,-10 L70,10 L60,60 L-10,60 Z" fill="#4c5666" />
                </g>
              </g>
            </g>
          </g>

          <Mechanic x={480} y={720} scale={1.15} />
          <Sparks x={520} y={820} active={frame % 44 < 24} />

          <SceneLabel eyebrow="Сервис" title="Ремонт экскаватора" />
        </svg>
      </ZoomWrap>
    </AbsoluteFill>
  );
}
