# PHASE 1.1 assets and media

## Official Wavy
- Higgsfield registered element: `wavy`, `94078c75-6b8d-476b-87b0-41bb2a3e6271`.
- Source media: `283cdd82-1a28-455b-ac7d-a1b710f3354d`.
- A new pose generation was not completed by the service. The registered original was used, with background removal and WebP optimization. No replacement character was generated.
- `assets/wavy.webp`: 768 x 1152, alpha, 60,020 bytes. Reused for masked head/body and Contact.
- This is limited 2D head motion, not a 3D character or independent eyeball rig.

## Real Space media still required
The five MP4 files named in the brief were unavailable in the supplied attachments and workspace. No stock or generated site footage is substituted. The selector and player are implemented; null sources intentionally show an explicit pending state and make no MP4 requests.

Place the actual reviewed clips at these repository paths:

- `public/inwave-renewal/videos/KakaoTalk_20260913_012948856.mp4`
- `public/inwave-renewal/videos/KakaoTalk_20260913_012918676.mp4`
- `public/inwave-renewal/videos/KakaoTalk_20260916_125353144.mp4`
- `public/inwave-renewal/videos/KakaoTalk_20260916_125435763.mp4`
- `public/inwave-renewal/videos/KakaoTalk_20260913_012956084.mp4`

Then set each matching `src` in `videos/manifest.json` to `./videos/<filename>` (relative to the page module directory). Optional `poster` uses the same base directory. Inspect actual content before assigning location labels; current labels are neutral scene numbers.

Playback: one active video, muted / loop / playsinline, lazy source attachment when the section enters the viewport, metadata preload, pause offscreen or while the document is hidden. Reduced-motion and data-saving preferences suppress automatic playback. The play button remains available. Actual MP4 playback, encoding compatibility and real iPhone playback require the supplied files and have not been verified.

## Demo and language
Hero and Your Data share pointer-proximity demo values; no camera or real visitor inference runs here. Korean is the default. `inwave-language` stores the selected Korean/English language locally. Existing scenarios, partner/location JSON and inquiry/privacy URLs remain in use.
