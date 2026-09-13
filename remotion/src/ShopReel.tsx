import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { PartsScene } from "./scenes/shop/PartsScene";
import { ManufacturingScene } from "./scenes/shop/ManufacturingScene";
import { ForkliftScene } from "./scenes/shop/ForkliftScene";
import { ReachTruckScene } from "./scenes/shop/ReachTruckScene";
import { ExcavatorScene } from "./scenes/shop/ExcavatorScene";
import { BulldozerScene } from "./scenes/shop/BulldozerScene";
import { DumpTruckScene } from "./scenes/shop/DumpTruckScene";
import { ReachStackerScene } from "./scenes/shop/ReachStackerScene";
import { SCENE_DURATION, TRANSITION_DURATION } from "./scenes/shop/shared";

export const SHOP_REEL_FPS = 30;
export const SHOP_REEL_WIDTH = 1920;
export const SHOP_REEL_HEIGHT = 1080;

const SCENE_COUNT = 8;

export const SHOP_REEL_TOTAL_FRAMES =
  SCENE_COUNT * SCENE_DURATION - (SCENE_COUNT - 1) * TRANSITION_DURATION;

const T = (
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
  />
);

export function ShopReel() {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <PartsScene />
        </TransitionSeries.Sequence>
        {T}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <ManufacturingScene />
        </TransitionSeries.Sequence>
        {T}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <ForkliftScene />
        </TransitionSeries.Sequence>
        {T}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <ReachTruckScene />
        </TransitionSeries.Sequence>
        {T}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <ExcavatorScene />
        </TransitionSeries.Sequence>
        {T}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <BulldozerScene />
        </TransitionSeries.Sequence>
        {T}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <DumpTruckScene />
        </TransitionSeries.Sequence>
        {T}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <ReachStackerScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
