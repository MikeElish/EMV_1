import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { WatercolorFilters, PaperGrainOverlay } from "../watercolor/Texture";

const RAIN = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 53) % 1920,
  offset: (i * 37) % 200,
  len: 22 + (i % 3) * 8,
}));

const BUILDINGS = [
  { x: 0, w: 260, h: 300, color: "#8a8a93" },
  { x: 250, w: 320, h: 360, color: "#9c9488" },
  { x: 560, w: 280, h: 320, color: "#8f8d95" },
  { x: 1520, w: 260, h: 300, color: "#948e90" },
  { x: 1760, w: 300, h: 340, color: "#8a8a93" },
];

export function RainyDoorScene() {
  const frame = useCurrentFrame();
  const walk = interpolate(frame, [0, 60], [0, 1], { extrapolateRight: "clamp" });
  const womanX = interpolate(walk, [0, 1], [1180, 1330]);
  const bob = Math.sin(frame / 5) * 3;
  const doorOpen = interpolate(frame, [0, 20], [0, 62], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(#7c8592, #9aa0ab 60%, #b7bcc4)" }}>
      <WatercolorFilters />
      <svg viewBox="0 0 1920 1080" width="100%" height="100%">
        <g filter="url(#watercolorWobble)" opacity={0.85}>
          {BUILDINGS.map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={620 - b.h} width={b.w} height={b.h} fill={b.color} />
              <rect x={b.x} y={600 - b.h} width={b.w} height={16} fill="#6f6c72" />
            </g>
          ))}
        </g>

        <rect x={0} y={620} width={1920} height={460} fill="#5d6169" />
        <rect x={0} y={620} width={1920} height={40} fill="#75798280" />

        {RAIN.map((r, i) => {
          const y = (frame * 22 + r.offset * 6) % 1100;
          return (
            <line
              key={i}
              x1={r.x}
              y1={y}
              x2={r.x - 14}
              y2={y + r.len}
              stroke="#eef2f6"
              strokeWidth={1.6}
              opacity={0.32}
            />
          );
        })}

        <g filter="url(#watercolorWobble)">
          <rect x={1000} y={650} width={430} height={140} rx={20} fill="#141316" />
          <path d="M1030,650 L1060,590 L1370,590 L1400,650 Z" fill="#141316" />
          <path d="M1040,644 L1064,600 L1200,600 L1200,644 Z" fill="#3a4048" opacity={0.7} />
          <circle cx={1050} cy={800} r={26} fill="#0c0c0e" />
          <circle cx={1370} cy={800} r={26} fill="#0c0c0e" />

          <g transform={`translate(1200,600) rotate(-${doorOpen})`}>
            <path d="M0,0 L170,-8 L172,58 L4,68 Z" fill="#1c1a1e" stroke="#000" strokeOpacity={0.3} />
          </g>
        </g>

        <g filter="url(#watercolorWobble)" transform="translate(1075,560)">
          <path d="M-10,150 L-10,60 L58,60 L58,150 Z" fill="#111114" />
          <circle cx={24} cy={30} r={22} fill="#e7c3a3" />
          <rect x={-4} y={44} width={20} height={70} fill="#111114" transform="rotate(18 -4 44)" />
          <rect x={40} y={40} width={16} height={90} fill="#111114" transform="rotate(-32 40 40)" />
          <path d="M20,-4 C-30,-4 -30,-40 20,-40 C70,-40 70,-4 20,-4 Z" fill="#0c0c0e" />
          <rect x={16} y={-40} width={6} height={90} fill="#0c0c0e" />
        </g>

        <g
          filter="url(#watercolorWobble)"
          transform={`translate(${womanX},${588 + bob})`}
        >
          <path
            d="M18,40 C-6,120 -18,210 -10,270 L46,270 C54,210 42,120 18,40 Z"
            fill="#b3122c"
          />
          <rect x={10} y={18} width={16} height={30} fill="#e9c6a6" />
          <circle cx={18} cy={8} r={16} fill="#e9c6a6" />
          <path d="M4,2 C4,-10 32,-10 32,2 C32,10 26,4 18,4 C10,4 4,10 4,2 Z" fill="#2a1a14" />
        </g>
      </svg>
      <PaperGrainOverlay />
    </AbsoluteFill>
  );
}
