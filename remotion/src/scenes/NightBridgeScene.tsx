import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Car } from "../watercolor/Car";
import { WatercolorFilters, PaperGrainOverlay } from "../watercolor/Texture";

const STARS = [
  [220, 90], [340, 60], [480, 110], [610, 70], [760, 130],
  [1550, 80], [1650, 140], [1740, 95], [1820, 150], [1400, 60],
];

const LAMPS_LEFT = [640, 700, 760, 820];
const LAMPS_RIGHT = [1240, 1300, 1360, 1420];

export function NightBridgeScene() {
  const frame = useCurrentFrame();
  const carX = interpolate(frame, [0, 78], [-260, 1960]);
  const twinkle = (i: number) =>
    0.4 + 0.5 * Math.abs(Math.sin(frame / 18 + i));

  return (
    <AbsoluteFill style={{ background: "linear-gradient(#0a0e26, #241f45 70%, #362a52)" }}>
      <WatercolorFilters />
      <svg viewBox="0 0 1920 1080" width="100%" height="100%">
        <circle cx={1650} cy={140} r={70} fill="#f4ecd8" opacity={0.18} filter="url(#watercolorWobble)" />
        <circle cx={1650} cy={140} r={44} fill="#fbf6e6" opacity={0.5} />

        {STARS.map(([sx, sy], i) => (
          <circle key={i} cx={sx} cy={sy} r={2.4} fill="#fff8e0" opacity={twinkle(i)} />
        ))}

        <g filter="url(#watercolorWobbleFine)">
          <path
            d="M230,620 L230,520 L270,520 L270,470 L310,470 L310,540 L560,540 L560,600 L230,620 Z"
            fill="#242c52"
            opacity={0.95}
          />
        </g>
        <ellipse cx={420} cy={260} rx={26} ry={130} fill="#f2d98a" opacity={0.16} />
        <g filter="url(#watercolorWobbleFine)">
          <rect x={414} y={220} width={14} height={260} fill="#242c52" />
          <ellipse cx={421} cy={214} rx={18} ry={11} fill="#f0d38f" opacity={0.9} />
          <circle cx={421} cy={192} r={8} fill="#f8e4ab" />
        </g>

        <rect x={0} y={640} width={1920} height={200} fill="#0c1830" opacity={0.9} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={-100 + ((frame * 1.2 + i * 340) % 2100)}
            y={660 + i * 24}
            width={160}
            height={3}
            fill="#cdd8ea"
            opacity={0.12}
          />
        ))}

        <g filter="url(#watercolorWobbleFine)">
          <rect x={560} y={740} width={300} height={16} fill="#20263f" />
          <rect x={1060} y={740} width={300} height={16} fill="#20263f" />
        </g>
        <g filter="url(#watercolorWobble)">
          <path d="M840,756 L900,756 L740,460 L700,480 Z" fill="#2a3155" />
          <path d="M1080,756 L1140,756 L1360,470 L1310,450 Z" fill="#2a3155" />
        </g>
        {LAMPS_LEFT.concat(LAMPS_RIGHT).map((lx, i) => (
          <g key={i}>
            <rect x={lx} y={732} width={3} height={16} fill="#171b2e" />
            <circle cx={lx + 1.5} cy={730} r={3} fill="#f6dfa0" opacity={0.8} />
          </g>
        ))}

        <rect x={0} y={840} width={1920} height={240} fill="#12100f" />
        <Car x={carX} y={790} scale={1.5} bodyColor="#1c1a1f" roofLight headlightGlow />
      </svg>
      <PaperGrainOverlay />
    </AbsoluteFill>
  );
}
