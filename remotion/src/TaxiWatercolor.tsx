import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { NightBridgeScene } from "./scenes/NightBridgeScene";
import { RainyDoorScene } from "./scenes/RainyDoorScene";
import { WinterStreetScene } from "./scenes/WinterStreetScene";
import { SpringLakhtaScene } from "./scenes/SpringLakhtaScene";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

const SCENE_DURATION = 78;
const TRANSITION_DURATION = 9;
const SCENE_COUNT = 4;

export const TOTAL_DURATION_FRAMES =
  SCENE_COUNT * SCENE_DURATION - (SCENE_COUNT - 1) * TRANSITION_DURATION;

export function TaxiWatercolor() {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <NightBridgeScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <RainyDoorScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <WinterStreetScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <SpringLakhtaScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
