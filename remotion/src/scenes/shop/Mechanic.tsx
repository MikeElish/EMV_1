import { useCurrentFrame } from "remotion";

// Small schematic mechanic silhouette with a wrench that rocks back and
// forth, as if tightening a bolt. Drawn in local ~90x140 units.
export function Mechanic({
  x,
  y,
  scale = 1,
  flip = false,
}: {
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
}) {
  const frame = useCurrentFrame();
  const wrenchAngle = Math.sin(frame / 5) * 18;

  return (
    <g transform={`translate(${x},${y}) scale(${scale * (flip ? -1 : 1)}, ${scale})`}>
      <ellipse cx={20} cy={132} rx={30} ry={7} fill="#000" opacity={0.25} />
      {/* legs */}
      <rect x={6} y={80} width={14} height={48} rx={4} fill="#2b3444" />
      <rect x={26} y={80} width={14} height={48} rx={4} fill="#232b38" />
      {/* torso (coveralls) */}
      <rect x={0} y={38} width={48} height={48} rx={10} fill="#ff9d3d" />
      <rect x={0} y={38} width={48} height={14} rx={7} fill="#e8842a" />
      {/* head */}
      <circle cx={24} cy={20} r={16} fill="#e7b98c" />
      <rect x={8} y={4} width={32} height={14} rx={6} fill="#20242c" />
      {/* arm + wrench */}
      <g transform={`translate(44,54) rotate(${wrenchAngle})`}>
        <rect x={0} y={-6} width={34} height={12} rx={5} fill="#e7b98c" />
        <g transform="translate(34,0)">
          <rect x={0} y={-5} width={30} height={10} rx={3} fill="#c8cdd6" />
          <path d="M28,-11 L44,-11 L44,-3 L36,-3 L36,3 L44,3 L44,11 L28,11 Z" fill="#c8cdd6" />
        </g>
      </g>
      <rect x={-2} y={38} width={12} height={44} rx={5} fill="#e7b98c" />
    </g>
  );
}
