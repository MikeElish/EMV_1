import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { WatercolorFilters, PaperGrainOverlay } from "../watercolor/Texture";

export const SEASON_FPS = 30;
const PHASE = 90; // 3s per season
const FADE = 16;
export const SEASON_TOTAL_FRAMES = PHASE * 4; // 12s

function windowWeight(frame: number, start: number, end: number) {
  const rise = interpolate(frame, [start, start + FADE], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fall = interpolate(frame, [end - FADE, end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(rise, fall);
}

// Blends an original-image point (905x605 painting) into the 1920x1080
// frame, matching the objectFit:"cover" scaling Img uses below.
function mapPoint(ix: number, iy: number) {
  const scale = 1080 / 605;
  const offsetX = (1920 - 905 * scale) / 2;
  return { x: offsetX + ix * scale, y: iy * scale };
}

type CarBlobProps = {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  flip?: boolean;
};

function CarBlob({ x, y, scale, opacity, flip }: CarBlobProps) {
  return (
    <g
      transform={`translate(${x},${y}) scale(${scale * (flip ? -1 : 1)}, ${scale})`}
      opacity={opacity}
      style={{ filter: "blur(1.4px)" }}
    >
      <ellipse cx={0} cy={0} rx={34} ry={12} fill="#1c1a1c" opacity={0.75} />
      <ellipse cx={0} cy={-8} rx={16} ry={8} fill="#2a2830" opacity={0.7} />
      <circle cx={30} cy={1} r={4} fill="#ffdca0" opacity={0.8} />
      <circle cx={-30} cy={1} r={3} fill="#c93a3a" opacity={0.6} />
    </g>
  );
}

const RAIN = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 47) % 1920,
  offset: (i * 33) % 240,
}));

const LEAVES = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 89) % 1920,
  offset: (i * 53) % 300,
  hue: i % 3,
}));

const SNOW = Array.from({ length: 60 }, (_, i) => ({
  x: (i * 61) % 1920,
  offset: (i * 41) % 320,
  r: 2 + (i % 3),
}));

const PETALS = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 113) % 1920,
  offset: (i * 71) % 280,
}));

const LEAF_COLORS = ["#d98a2b", "#e0b03a", "#b5451f"];

export function StIsaacSeasons() {
  const frame = useCurrentFrame();

  const summer = windowWeight(frame, 0, PHASE);
  const autumn = windowWeight(frame, PHASE, PHASE * 2);
  const winter = windowWeight(frame, PHASE * 2, PHASE * 3);
  const spring = windowWeight(frame, PHASE * 3, PHASE * 4);

  const laneA = mapPoint(380, 348);
  const laneAEnd = mapPoint(850, 348);
  const laneBStart = mapPoint(460, 328);
  const laneBEnd = mapPoint(870, 590);

  const car1T = ((frame % 130) + 130) % 130;
  const car1X = interpolate(car1T, [0, 130], [laneA.x, laneAEnd.x]);

  const car2T = ((frame + 70) % 150);
  const car2X = interpolate(car2T, [0, 150], [laneAEnd.x, laneA.x]);

  const car3T = (frame % 110) / 110;
  const car3X = interpolate(car3T, [0, 1], [laneBStart.x, laneBEnd.x]);
  const car3Y = interpolate(car3T, [0, 1], [laneBStart.y, laneBEnd.y]);
  const car3Scale = interpolate(car3T, [0, 1], [0.32, 1.05]);
  const car3Opacity = interpolate(
    car3T,
    [0, 0.08, 0.85, 1],
    [0, 0.55, 0.55, 0]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <WatercolorFilters />
      <Img
        src={staticFile("stisaac.jpg")}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <CarBlob x={car1X} y={laneA.y} scale={0.4} opacity={0.5} />
        <CarBlob x={car2X} y={laneAEnd.y - 6} scale={0.36} opacity={0.45} flip />
        <CarBlob x={car3X} y={car3Y} scale={car3Scale} opacity={car3Opacity} />
      </svg>

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(rgba(255,214,140,1), rgba(255,214,140,1))",
          opacity: summer * 0.12,
        }}
      />
      <AbsoluteFill
        style={{ background: "rgba(110,122,136,1)", opacity: autumn * 0.28 }}
      />
      <AbsoluteFill
        style={{ background: "rgba(214,228,238,1)", opacity: winter * 0.34 }}
      />
      <AbsoluteFill
        style={{ background: "rgba(214,232,176,1)", opacity: spring * 0.14 }}
      />

      {autumn > 0 && (
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          {RAIN.map((r, i) => {
            const y = (frame * 24 + r.offset * 6) % 1100;
            return (
              <line
                key={i}
                x1={r.x}
                y1={y}
                x2={r.x - 12}
                y2={y + 26}
                stroke="#eef2f6"
                strokeWidth={1.4}
                opacity={autumn * 0.3}
              />
            );
          })}
          {LEAVES.map((l, i) => {
            const y = (frame * 3.1 + l.offset * 3) % 1080;
            const x = l.x + Math.sin(frame / 14 + i) * 26;
            const rot = (frame * 4 + i * 40) % 360;
            return (
              <ellipse
                key={i}
                cx={x}
                cy={y}
                rx={9}
                ry={5}
                fill={LEAF_COLORS[l.hue]}
                opacity={autumn * 0.8}
                transform={`rotate(${rot} ${x} ${y})`}
              />
            );
          })}
        </svg>
      )}

      {winter > 0 && (
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          {SNOW.map((s, i) => {
            const y = (frame * 3.6 + s.offset * 3) % 1080;
            const x = s.x + Math.sin(frame / 22 + i) * 12;
            return (
              <circle key={i} cx={x} cy={y} r={s.r} fill="#ffffff" opacity={winter * 0.85} />
            );
          })}
        </svg>
      )}

      {spring > 0 && (
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          {PETALS.map((p, i) => {
            const y = (frame * 2.2 + p.offset * 3) % 900;
            const x = p.x + Math.sin(frame / 16 + i) * 30;
            return (
              <circle key={i} cx={x} cy={y} r={4} fill="#f7c8d6" opacity={spring * 0.7} />
            );
          })}
        </svg>
      )}

      <PaperGrainOverlay />
    </AbsoluteFill>
  );
}
