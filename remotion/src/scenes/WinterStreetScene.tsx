import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Car } from "../watercolor/Car";
import { WatercolorFilters, PaperGrainOverlay } from "../watercolor/Texture";

const SNOW = Array.from({ length: 50 }, (_, i) => ({
  x: (i * 71) % 1920,
  offset: (i * 53) % 300,
  r: 2 + (i % 3),
  drift: (i % 5) - 2,
}));

const BUILDINGS_L = [
  { x: -40, y: 300, w: 300, h: 420 },
  { x: 240, y: 360, w: 260, h: 360 },
];
const BUILDINGS_R = [
  { x: 1420, y: 340, w: 280, h: 380 },
  { x: 1680, y: 300, w: 300, h: 420 },
];

export function WinterStreetScene() {
  const frame = useCurrentFrame();
  const carX = interpolate(frame, [0, 78], [-260, 1960]);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(#cfe6f5, #eaf3fa 55%, #f7fbff)" }}>
      <WatercolorFilters />
      <svg viewBox="0 0 1920 1080" width="100%" height="100%">
        <circle cx={340} cy={180} r={80} fill="#fff7de" opacity={0.7} />
        <circle cx={340} cy={180} r={130} fill="#fff2c8" opacity={0.25} />

        <g filter="url(#watercolorWobble)">
          {BUILDINGS_L.concat(BUILDINGS_R).map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#c9c2c6" />
              <rect x={b.x - 6} y={b.y - 18} width={b.w + 12} height={26} fill="#ffffff" opacity={0.9} />
            </g>
          ))}
        </g>

        <rect x={0} y={700} width={1920} height={380} fill="#eef4f8" />
        <rect x={0} y={760} width={1920} height={200} fill="#b9c4cc" opacity={0.55} />
        <rect x={0} y={840} width={1920} height={40} fill="#ffffff" opacity={0.7} />

        {SNOW.map((s, i) => {
          const y = (frame * 3.4 + s.offset * 3) % 1080;
          const x = s.x + Math.sin(frame / 20 + i) * 14 * s.drift * 0.2;
          return <circle key={i} cx={x} cy={y} r={s.r} fill="#ffffff" opacity={0.85} />;
        })}

        <Car x={carX} y={800} scale={1.5} bodyColor="#e2b23c" roofLight headlightGlow={false} />
      </svg>
      <PaperGrainOverlay />
    </AbsoluteFill>
  );
}
