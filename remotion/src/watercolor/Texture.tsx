import { AbsoluteFill } from "remotion";

// Shared SVG filter defs (irregular "wet paper" edge wobble + paper grain
// noise) reused by every scene. Kept self-contained per scene instance
// rather than hoisted to a single global <defs>, so each scene's own <svg>
// always resolves its url(#...) references regardless of mount order.
export function WatercolorFilters() {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }}>
      <defs>
        <filter id="watercolorWobble" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="soft" />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.010 0.016"
            numOctaves={2}
            seed={7}
            result="noise"
          />
          <feDisplacementMap
            in="soft"
            in2="noise"
            scale={18}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id="watercolorWobbleFine" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves={2}
            seed={11}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={4}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id="paperGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={2}
            seed={3}
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.9 0 0 0 0"
          />
        </filter>
      </defs>
    </svg>
  );
}

export function PaperGrainOverlay() {
  return (
    <>
      <AbsoluteFill
        style={{ mixBlendMode: "multiply", opacity: 0.24, pointerEvents: "none" }}
      >
        <svg width="100%" height="100%">
          <rect width="100%" height="100%" filter="url(#paperGrain)" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(20,14,10,0.38) 100%)",
        }}
      />
    </>
  );
}
