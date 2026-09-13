import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WatercolorFilters, PaperGrainOverlay } from "../watercolor/Texture";

const PETALS = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 91) % 1920,
  offset: (i * 41) % 260,
  r: 3 + (i % 2) * 2,
}));

const TOWER_SEGMENTS = 9;

export function SpringLakhtaScene() {
  const frame = useCurrentFrame();
  const walk = interpolate(frame, [0, 55], [0, 1], { extrapolateRight: "clamp" });
  const manX = interpolate(walk, [0, 1], [1560, 1370]);
  const bob = Math.sin(frame / 5) * 3;
  const doorOpen = interpolate(frame, [0, 20], [0, 58], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(#bfe3f2, #eaf6ee 65%, #f6f4d9)" }}>
      <WatercolorFilters />
      <svg viewBox="0 0 1920 1080" width="100%" height="100%">
        <circle cx={1650} cy={150} r={70} fill="#fff3c2" opacity={0.8} />
        {[[260, 140, 110], [420, 190, 80], [1150, 120, 130]].map(([cx, cy, r], i) => (
          <ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 0.5} fill="#ffffff" opacity={0.65} />
        ))}

        <g filter="url(#watercolorWobbleFine)">
          {Array.from({ length: TOWER_SEGMENTS }).map((_, i) => {
            const t = i / (TOWER_SEGMENTS - 1);
            const width = 150 - t * 120;
            const cx = 260 + Math.sin(t * 2.4) * 26;
            const y = 640 - t * 480;
            return (
              <path
                key={i}
                d={`M${cx - width / 2},${y} L${cx + width / 2},${y} L${cx + width / 2 - 14},${y - 62} L${cx - width / 2 + 14},${y - 62} Z`}
                fill={i % 2 === 0 ? "#aeccdc" : "#8fb6cb"}
                opacity={0.9}
              />
            );
          })}
          <circle cx={260 + Math.sin(2.4) * 26} cy={158} r={5} fill="#e7dfae" />
        </g>

        <rect x={0} y={760} width={1920} height={320} fill="#8fbf6e" />
        <rect x={0} y={750} width={1920} height={18} fill="#a7d488" />
        {[[120, 760], [1780, 770], [1680, 800]].map(([tx, ty], i) => (
          <g key={i} filter="url(#watercolorWobble)">
            <rect x={tx} y={ty} width={10} height={60} fill="#6b4a34" />
            <circle cx={tx + 5} cy={ty - 18} r={44} fill="#5f9a4c" />
          </g>
        ))}

        {PETALS.map((p, i) => {
          const y = (frame * 2.6 + p.offset * 3) % 900;
          const x = p.x + Math.sin(frame / 15 + i) * 30;
          return <circle key={i} cx={x} cy={y} r={p.r} fill="#f6b6c6" opacity={0.75} />;
        })}

        <g filter="url(#watercolorWobble)">
          <rect x={1180} y={720} width={420} height={140} rx={20} fill="#2b3e52" />
          <path d="M1210,720 L1240,660 L1540,660 L1570,720 Z" fill="#2b3e52" />
          <path d="M1220,714 L1244,670 L1380,670 L1380,714 Z" fill="#7fa3bd" opacity={0.7} />
          <circle cx={1230} cy={868} r={26} fill="#14181d" />
          <circle cx={1540} cy={868} r={26} fill="#14181d" />

          <g transform={`translate(1380,670) rotate(-${doorOpen})`}>
            <path d="M0,0 L166,-6 L168,60 L4,68 Z" fill="#324357" stroke="#000" strokeOpacity={0.2} />
          </g>
        </g>

        <g filter="url(#watercolorWobble)" transform={`translate(${manX},${628 + bob})`}>
          <rect x={-14} y={40} width={44} height={110} rx={8} fill="#2b3138" />
          <circle cx={8} cy={24} r={20} fill="#e2b48f" />
          <rect x={26} y={44} width={14} height={54} rx={6} fill="#2b3138" transform="rotate(-70 26 44)" />
          <rect x={30} y={2} width={12} height={16} rx={3} fill="#171a1e" />
        </g>
      </svg>
      <PaperGrainOverlay />
    </AbsoluteFill>
  );
}
