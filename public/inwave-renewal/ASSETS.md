# PHASE 1.2 assets and media

## Official Wavy

- Registered Higgsfield element: `wavy`, `94078c75-6b8d-476b-87b0-41bb2a3e6271`.
- Original element media: `283cdd82-1a28-455b-ac7d-a1b710f3354d`.
- Front-facing generation: `3fe7ff7b-5cfc-4c05-984d-f6358a6bea1d`.
- Pupil-free rig generation: `9711ac37-e32e-411f-98b7-55d4c1a95551`.
- `assets/wavy-front.webp`: static front-facing/contact image with natural connected tail.
- `assets/wavy-poses/center.webp`: approved full-body Hero master, copied from
  `assets/wavy-front.webp` and used as the safe fallback for every pose until
  reviewed directional assets are supplied.

The Hero now uses a paused full-body head-turn video (`assets/wavy-head-turn.mp4`), controlled by face-relative pointer position. The original natural-eyed `assets/wavy-front.webp` remains the loading/error fallback. See WAVY-VIDEO.md for source and timing. Legacy fallback pose changes are preloaded and
crossfaded; no CSS pupils, clipped head layer, or raster 3D rotation is used.

## Single Real Space video

Phase 1.2 removes the five-item selector and supports one verified installation
video after Privacy and before Technology. The required source
`KakaoTalk_20260913_012918676.mp4` was not present in the supplied attachments,
workspace, or user files at implementation time. Existing `public/images/main.mp4`
and `main_test.mp4` were visually inspected and are marketing/demo street scenes,
not the requested shopping-mall installation footage, so they are not substituted.

When the reviewed source is supplied:

1. Add it as
   `public/inwave-renewal/videos/KakaoTalk_20260913_012918676.mp4`.
2. Set the Real Space video element's `data-src` to
   `./videos/KakaoTalk_20260913_012918676.mp4`.
3. Verify its real aspect ratio, crop, autoplay and iPhone playback.
4. Remove the `#space-missing` fallback after playback verification.

The single-video runtime attaches the source near the viewport, uses metadata
preload, pauses offscreen/hidden playback, and respects reduced-motion and
data-saving preferences.

## Demo state

One `demoMetrics` object feeds the Hero cards, Your Data headline and receipt.
No camera, biometric input or live visitor analysis runs on this page.
