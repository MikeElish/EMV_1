import { Composition } from "remotion";
import {
  TaxiWatercolor,
  TOTAL_DURATION_FRAMES,
  FPS,
  WIDTH,
  HEIGHT,
} from "./TaxiWatercolor";
import { StIsaacSeasons, SEASON_TOTAL_FRAMES, SEASON_FPS } from "./scenes/StIsaacSeasons";
import { SeasonalPainting, type PaintingLane } from "./scenes/SeasonalPainting";
import {
  ShopReel,
  SHOP_REEL_TOTAL_FRAMES,
  SHOP_REEL_FPS,
  SHOP_REEL_WIDTH,
  SHOP_REEL_HEIGHT,
} from "./ShopReel";

const uslugiLanes: PaintingLane[] = [
  { start: [60, 505], end: [520, 415], period: 140, scale: 0.42, baseOpacity: 0.5 },
  { start: [520, 415], end: [60, 505], period: 160, offset: 40, scale: 0.38, flip: true, baseOpacity: 0.45 },
  { start: [500, 410], end: [140, 565], period: 110, offset: 20, scale: [0.3, 1.05], fadeEnds: true, baseOpacity: 0.55 },
];

const fleetLanes: PaintingLane[] = [
  { start: [100, 900], end: [700, 860], period: 150, scale: 0.5, baseOpacity: 0.5 },
  { start: [700, 860], end: [100, 900], period: 170, offset: 50, scale: 0.44, flip: true, baseOpacity: 0.45 },
  { start: [650, 845], end: [150, 985], period: 120, offset: 15, scale: [0.34, 1.1], fadeEnds: true, baseOpacity: 0.55 },
];

const jobsLanes: PaintingLane[] = [
  { start: [10, 455], end: [330, 385], period: 130, scale: 0.34, baseOpacity: 0.5 },
  { start: [330, 385], end: [10, 455], period: 150, offset: 35, scale: 0.3, flip: true, baseOpacity: 0.45 },
  { start: [300, 390], end: [55, 500], period: 100, offset: 10, scale: [0.26, 0.9], fadeEnds: true, baseOpacity: 0.55 },
];

const aboutLanes: PaintingLane[] = [
  { start: [1490, 770], end: [1300, 860], period: 150, scale: 0.3, baseOpacity: 0.5 },
  { start: [1300, 860], end: [1490, 770], period: 170, offset: 45, scale: 0.26, flip: true, baseOpacity: 0.45 },
  { start: [20, 960], end: [380, 860], period: 140, offset: 25, scale: 0.28, baseOpacity: 0.4 },
];

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="TaxiWatercolor"
        component={TaxiWatercolor}
        durationInFrames={TOTAL_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="StIsaacSeasons"
        component={StIsaacSeasons}
        durationInFrames={SEASON_TOTAL_FRAMES}
        fps={SEASON_FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="UslugiSeasons"
        component={SeasonalPainting}
        durationInFrames={SEASON_TOTAL_FRAMES}
        fps={SEASON_FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          image: "uslugi.jpg",
          nativeWidth: 1200,
          nativeHeight: 843,
          lanes: uslugiLanes,
        }}
      />
      <Composition
        id="FleetSeasons"
        component={SeasonalPainting}
        durationInFrames={SEASON_TOTAL_FRAMES}
        fps={SEASON_FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          image: "fleet.jpg",
          nativeWidth: 1536,
          nativeHeight: 1096,
          lanes: fleetLanes,
        }}
      />
      <Composition
        id="JobsSeasons"
        component={SeasonalPainting}
        durationInFrames={SEASON_TOTAL_FRAMES}
        fps={SEASON_FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          image: "jobs.jpg",
          nativeWidth: 800,
          nativeHeight: 558,
          lanes: jobsLanes,
        }}
      />
      <Composition
        id="AboutSeasons"
        component={SeasonalPainting}
        durationInFrames={SEASON_TOTAL_FRAMES}
        fps={SEASON_FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          image: "about.jpg",
          nativeWidth: 1500,
          nativeHeight: 1046,
          lanes: aboutLanes,
        }}
      />
      <Composition
        id="ShopReel"
        component={ShopReel}
        durationInFrames={SHOP_REEL_TOTAL_FRAMES}
        fps={SHOP_REEL_FPS}
        width={SHOP_REEL_WIDTH}
        height={SHOP_REEL_HEIGHT}
      />
    </>
  );
}
