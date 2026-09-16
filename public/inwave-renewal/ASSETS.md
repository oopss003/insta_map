# PHASE 1.2 assets and media

## Official Wavy

- Registered Higgsfield element: `wavy`, `94078c75-6b8d-476b-87b0-41bb2a3e6271`.
- Original element media: `283cdd82-1a28-455b-ac7d-a1b710f3354d`.
- Front-facing generation: `3fe7ff7b-5cfc-4c05-984d-f6358a6bea1d`.
- Pupil-free rig generation: `9711ac37-e32e-411f-98b7-55d4c1a95551`.
- `assets/wavy-front.webp`: static front-facing/contact image with natural connected tail.
- `assets/wavy-front-eyeless.webp`: transparent base used by the Hero eye/head rig.

Both web assets are 768 × 1152 WebP files. The Hero uses a masked body, a slower
head layer and two faster CSS pupils contained within eye-socket masks. This is a
2D web rig, not a 3D model.

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
