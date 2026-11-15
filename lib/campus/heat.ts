/**
 * Admin heat map: colour each GT building by how many OPEN requests it has.
 * Change the thresholds here and the 3D map, its legend and the tests all follow.
 *   0 – GREEN_MAX          → green  ("OK")
 *   GREEN_MAX+1 – YELLOW_MAX → yellow ("Busy")
 *   YELLOW_MAX+1 and up      → red    ("Hot spot", also marked with a pulsing pin)
 */
export const HEAT_THRESHOLDS = { greenMax: 2, yellowMax: 5 } as const;

export type HeatBand = "green" | "yellow" | "red";

/**
 * Colours are the standard good / warning / critical status colours. They always appear with
 * a text label in the legend, and red buildings also get a tall pin, so colour is never the only cue.
 */
export const HEAT_META: Record<HeatBand, { label: string; color: string; range: string }> = {
  green: { label: "OK", color: "#0ca30c", range: `0–${HEAT_THRESHOLDS.greenMax} open` },
  yellow: { label: "Busy", color: "#f2b10f", range: `${HEAT_THRESHOLDS.greenMax + 1}–${HEAT_THRESHOLDS.yellowMax} open` },
  red: { label: "Hot spot", color: "#d03b3b", range: `${HEAT_THRESHOLDS.yellowMax + 1}+ open` },
};

export const HEAT_BANDS: HeatBand[] = ["green", "yellow", "red"];

export function heatBand(openCount: number): HeatBand {
  if (openCount <= HEAT_THRESHOLDS.greenMax) return "green";
  if (openCount <= HEAT_THRESHOLDS.yellowMax) return "yellow";
  return "red";
}
