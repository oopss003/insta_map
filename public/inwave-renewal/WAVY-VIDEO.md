# Wavy mouse-controlled head turn

Generation job: `7fc99ee1-323c-4cfe-85da-c172fb433459`
Model: Kling 3.0 Pro, 10 seconds, silent.
Reference: existing approved `assets/wavy-front.webp` (start and end).
Status: first generation selected after frame-by-frame inspection. Second attempt ecbddcb7-0912-4975-b1b2-dbfbb2a786de rejected because the torso turns.

## Generation prompt

Create a single continuous locked-camera character head-turn reference clip for an interactive website. Preserve the EXACT Wavy chameleon character from the reference: green skin, orange eyelids, original natural eyes, crest, dark zip jacket, light trousers, feet, curled tail. Full body centered and fully visible at constant size. Body, shoulders, jacket, arms, hands, legs, feet, tail and ground shadow remain perfectly still and identical throughout. Only the head rotates naturally at the neck and the two eyes look together in the same direction. No independent wandering pupils. Fixed flat solid warm yellow background #FFE43B, no gradients, no scenery. Locked camera, fixed framing, fixed lighting. Timeline: 0.0-0.7 seconds exact front view with both eyes looking directly at the viewer. 0.7-2.7 seconds smoothly turn only the head 25 degrees toward SCREEN LEFT, eyes looking screen left. 2.7-3.2 seconds hold left. 3.2-5.0 seconds smoothly return to exact front-facing eye contact. 5.0-5.5 seconds hold exact front. 5.5-7.5 seconds smoothly turn only the head 25 degrees toward SCREEN RIGHT, eyes looking screen right. 7.5-8.0 seconds hold right. 8.0-9.5 seconds smoothly return to exact original frontal pose. 9.5-10.0 seconds hold exact front-facing eye contact. Anatomically coherent eyes remain behind original eyelids at all times. Maintain same expression, mouth closed, no talking, no blinking, no body sway, no breathing, no gestures, no camera movement, no zoom, no cuts, no morphing, no changes in character proportions or clothing. Slow precise continuous head rotation suitable for seeking forward and backward by mouse position.

## Interaction requirements

- Map pointer position relative to Wavy's face, not accumulated mouse movement.
- Use inspected left/front/right frame times, not assumed prompt timestamps.
- Force front-facing frame inside the face-centered eye-contact ellipse.
- Keep a natural-eyed static fallback if video loading or seeking fails.
- No autoplay, camera access, CSS pupils, clipped head or raster 3D rotation.
- Keep Hero and Your Data on the same demoMetrics state.
  Selected source ranges: front 0.04s, left 1.5s, right 6.2s, right-front 7.1s. Eye contact uses the original open-eye front frame. Video is 600x900 H.264 with every frame independently decodable. Exterior black background is replaced with Hero yellow; no head/body clipping is used.
