# Expected results

Use these to test the website. Numbers are from the Python reference (PIL resize to 512 px).
The browser resizes slightly differently: pass/fail and statuses must match exactly; numbers within about 10% (sharpness), 2 (light), 2 points (leaf %, affected %).

## Photo Coach and affected area (public/samples)

| Photo | Sharpness | Light | Over-exposed % | Leaf % | Affected % | Result |
|---|---|---|---|---|---|---|
| blurry-photo.jpg | 2.6 | 136.1 | 0.0 | 74.0 | 1.99 | FAIL |
| busy-background.jpg | 75.4 | 115.5 | 0.0 | 83.5 | 4.09 | PASS |
| dark-photo.jpg | 113.9 | 29.6 | 0.0 | 30.5 | 11.95 | FAIL |
| early-blight-closeup.jpg | 763.2 | 161.7 | 0.13 | 42.6 | 22.98 | PASS |
| early-blight-field.jpg | 347.3 | 118.3 | 0.11 | 74.4 | 42.91 | PASS |
| early-blight-lab.jpg | 96.2 | 95.3 | 0.0 | 38.2 | 4.68 | PASS |
| field-row.jpg | 975.0 | 107.7 | 0.0 | 51.1 | 14.79 | PASS |
| healthy-leaf.jpg | 188.0 | 113.2 | 0.0 | 94.8 | 0.02 | PASS |
| late-blight-field.jpg | 245.0 | 105.0 | 0.25 | 91.4 | 9.55 | PASS |
| septoria-closeup.jpg | 364.0 | 136.1 | 0.11 | 71.6 | 3.71 | PASS |
| septoria-field.jpg | 356.0 | 117.6 | 0.08 | 67.9 | 12.0 | PASS |

Thresholds: sharpness >= 40, light 60-200 with <= 5% over-exposed, leaf >= 30%.

## Leaf Watch compare (days = 2)

| Pair | Status | New spots | New holes | Affected old -> new | Alignment |
|---|---|---|---|---|---|
| synthetic-first-spot-visit-1 → visit-2 | first_spots_found | 2 | 0 | 0.28 -> 0.59 | good (orb+homography) |
| synthetic-first-spot-visit-2 → visit-1 | stable | 0 | 0 | 0.59 -> 0.28 | good (orb+homography) |
| synthetic-spreading-visit-1 → visit-2 | spreading | 4 | 0 | 4.91 -> 4.72 | good (orb+homography) |
| synthetic-spreading-visit-2 → visit-1 | stable | 0 | 0 | 4.72 -> 4.91 | good (orb+homography) |

Any photo compared with itself: stable, 0 new.
Measured in headless Chromium with the kit's TypeScript: same statuses and counts; OpenCV.js load about 1 s; each compare about 0.3 s on a laptop.

## Diagnosis demo values (answer level, confidence)

| Sample | Top answer | Level | Confidence |
|---|---|---|---|
| early-blight-closeup | Early blight 0.86 | CLEAR | high |
| early-blight-field | Early blight 0.67 | CLEAR | medium |
| septoria-closeup | Septoria 0.55 vs Early blight 0.38 | CHECK | medium |
| septoria-field | Septoria 0.72 | CLEAR | medium |
| late-blight-field | Late blight 0.41 | EXPERT | low |
| healthy-leaf | Healthy 0.91 | CLEAR | high |
| early-blight-lab | Early blight 0.95 | CLEAR | high |
| blurry-photo, dark-photo | (photo check fails) | RETAKE | - |

## Radar sample data
Exactly one unusual rise: Early blight, 5 reports this week vs 0.67 weekly average. Late blight and Septoria: no alert (steady).

## Risk test scenarios (tests/rules.test.ts)
- Cool and wet nights: late blight 65 (high), check every 2 days.
- Warm and wet + 6 mm rain + fruiting + 3 nearby reports: leaf spots 80 (high); late blight 50 (medium).
- Dry: 10 (low), check every 5 days.

## Run the tests
```
npm i -D tsx sharp @techstark/opencv-js onnxruntime-web
npx tsx tests/rules.test.ts public
npx tsx tests/parity.test.ts <folder with work PNGs and python.json>
```
