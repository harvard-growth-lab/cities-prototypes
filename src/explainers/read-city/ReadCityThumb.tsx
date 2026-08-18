import { useEffect, useRef } from "react";
import { SKY_H, SKY_W, drawSkyline, type SkyScene } from "./skyline";

/** Gallery-card art for "How to Read a City": a real frame from the page,
 *  drawn by the page's own renderer — not an approximation of it. The scene
 *  is act III's closing beat ("Now read your own city"): dawn over Anyville
 *  with the crane up over the lot, trucks on the bridge, and the night's
 *  last windows still lit — the one frame that carries every sign the story
 *  teaches, and light enough to sit on the gallery's white paper. Drawn
 *  once, static (the card doesn't animate; the page does). */
const FRAME: SkyScene = {
  hour: 6.6,
  occ: 0.95,
  flow: 0.3,
  factory: 0.7,
  harbor: 0.75,
  crane: 0.5,
  build: 1,
  fortress: 0,
  rain: 0,
};

export function ReadCityThumb() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawSkyline(ctx, 2.4, FRAME);
  }, []);

  return (
    <canvas
      ref={ref}
      width={SKY_W}
      height={SKY_H}
      role="img"
      aria-label="A pixel-art riverfront city at dawn — a tower crane over a new building, trucks on the bridge, windows still lit"
      /* the card box is 5:4 and the scene 16:9 — cover-crop the middle of
         town, letting the bridge and the office run off-frame the way the
         full-bleed page does. Styled inline because .ex-thumb only dresses
         svg children. */
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        imageRendering: "pixelated",
      }}
    />
  );
}
