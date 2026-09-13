type CarProps = {
  x: number;
  y: number;
  scale?: number;
  bodyColor: string;
  roofLight?: boolean;
  headlightGlow?: boolean;
  flip?: boolean;
};

// Stylised sedan silhouette, side view, drawn in local 200x70 units and
// positioned via a translate/scale transform from the caller.
export function Car({
  x,
  y,
  scale = 1,
  bodyColor,
  roofLight = false,
  headlightGlow = false,
  flip = false,
}: CarProps) {
  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale * (flip ? -1 : 1)}, ${scale})`}
      filter="url(#watercolorWobble)"
    >
      {headlightGlow && (
        <ellipse cx={195} cy={45} rx={40} ry={16} fill="#ffe9a8" opacity={0.55} />
      )}
      <rect x={0} y={30} width={200} height={28} rx={12} fill={bodyColor} />
      <path
        d="M42,30 L62,4 L138,4 L158,30 Z"
        fill={bodyColor}
      />
      <path
        d="M50,26 L66,10 L132,10 L148,26 Z"
        fill="#dfeaf2"
        opacity={0.55}
      />
      <circle cx={42} cy={60} r={15} fill="#241d1a" />
      <circle cx={158} cy={60} r={15} fill="#241d1a" />
      {roofLight && (
        <rect x={90} y={-6} width={20} height={9} rx={2} fill="#f5c518" />
      )}
    </g>
  );
}
