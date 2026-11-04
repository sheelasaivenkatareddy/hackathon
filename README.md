# Patra Lens

Catch the first spot. A phone web app for early detection of crop pests and diseases: it photographs the same leaves every few days and flags new spots as soon as they appear.

Patra Lens helps you catch crop problems early, from a photo on your phone. The AI covers 27 conditions on 13 plants. Everything runs in the browser: no backend, no API keys, no paid services.

## What is in it

- **Scan:** upload, drag and drop, or use the camera. Photo checks, then the AI answers with its top 3, a plain-language summary, a symptom checklist, fertilizer and treatment guidance, measured accuracy, live conditions, read aloud and share.
- **Dashboard:** weather alerts, risk cards, recent scans, plants due for a check, and an advice box with the Kisan Call Centre helpline.
- **Leaf Watch:** photograph the same leaves every few days and see new spots ringed.
- **Risk and Radar:** weather rules and a map of confirmed reports. The radar shows real reports only until you ask for an example.
- **Disease library, My scans, Expert queue, Settings.**
- **Pages for trust:** Privacy, Terms and How it works.

Data is checked with Zod schemas (`src/lib/schemas.ts`) before it is used. Everything is stored on the device. To move to a hosted database later, replace the calls in `src/lib/db.ts`.

## The AI

A free model, [plant-disease-dinov2-small](https://huggingface.co/rodynaemad/plant-disease-dinov2-small) (CC BY-SA 4.0), runs on the phone. We retrained its last layer on PlantDoc field photos, because it did poorly on them as downloaded.

Results on the 236 PlantDoc test photos, scored once, with duplicates removed from training:

| | As downloaded | Retrained |
|---|---|---|
| Top answer right | 40% | 72% (95% range 66–77%) |
| Right answer in top 3 | 73%* | 96% |
| Confidence error (ECE) | 0.41* | 0.04 |

\* Limited to the same 27 classes, which is fairer to the original model. Across all its 38 classes, top-1 is the 40% shown.

Limits to state plainly: these are public photos, not local farms. Tomato alone scores 54%, and only 2 of 8 healthy tomato leaves were recognised. A plant outside the 13 can get a wrong answer. The first scan downloads about 23 MB. About 3 seconds per scan on a laptop; phones are not measured yet.

Recreate the layer with `ml/field-head/` (`unpack_plantdoc.py`, then `extract.py`, then `train_head.py`). Python needs `onnxruntime`, `scikit-learn`, `numpy` and `pillow`. Credits are in `public/model/FIELD_MODEL_CREDITS.txt`.

## Settings you may want to change

- `site.contactEmail` in `src/config.ts`: leave empty to show no public contact address. If you set it, a Contact link appears in the footer.
- `alerts` in `src/config.ts`: the heat, rain and humidity thresholds for weather alerts.
- `VITE_GOOGLE_CLIENT_ID`: optional Google sign-in for the admin screen.

## Free services

| Service | Used for | Key needed |
|---|---|---|
| Open-Meteo | Weather, soil moisture and soil temperature | No |
| SoilGrids (ISRIC) | Soil pH, nitrogen and organic carbon for the wider area. Often down; the page copes | No |
| BigDataCloud | Place name for the approximate area | No |
| Wikipedia | Short disease descriptions | No |
| OpenStreetMap | Map | No |

Only the rounded 1 km area, or Bengaluru by default, is ever sent. Results are saved so they keep working offline.

## Action plan

`src/lib/nutrition.ts` holds what is shown after a diagnosis. Keep to these rules when editing it:

- Amounts are approximate, for the whole crop, and only where a university recommendation exists (tomato, potato, corn). They are not an extra dose for disease.
- Specific advice appears only for a CLEAR answer. CHECK and EXPERT answers get general soil care.
- A disease gets specific advice only when a source supports it.
- The recovery timeline is an estimate, labelled as one, and never promises a cure. Fertilizer does not cure disease.
- No pesticide names, doses or spray schedules.

Have a local agriculture expert review this file before real farmers use it. The doses are Tamil Nadu recommendations, so Karnataka or Andhra Pradesh numbers may differ.

## Run it

On Windows, double-click `START-PATRA-LENS.bat`. Otherwise, you need Node 18 or newer:

```
npm install
npm run dev
```

Open http://localhost:5173.

Use plain `npm install`. It also copies OpenCV.js and ONNX Runtime into `public/`. Installing one package by name (`npm i something`) skips that step, so run `npm install` again afterwards.

The live camera needs HTTPS or localhost. Upload and sample photos work everywhere.

## Before the demo

1. Check you can log in to the Expert screen as admin (see below).
2. Open **Settings > Prepare for offline** on Wi-Fi, so the comparison engine and samples are saved.
3. Add real timeline photos if you have them (see below). Until then, **Load test pair** on Leaf Watch shows the compare feature, with a "Synthetic" chip.

The full script is in `03_DEMO_SCRIPT.md` in the Developer Kit.

## Cloud database, AI vision and the admin page

With Supabase connected, every scan is saved online (photo, result, the farmer's name, phone and village if given) and an admin can see all of them at `/admin`. With a Claude API key added, each photo is also checked by Claude vision (`claude-opus-5-5`). It says whether the photo shows a leaf, a flower or no plant at all, and whether the plant is tomato. It circles each diseased area in red and each dried or damaged area in yellow, and it writes a care plan covering precautions, watering, fertilizer, and chemical and organic sprays with doses, in English, Telugu and Hindi.

Without the key, the phone's own model gives the answer, the circles come from leaf colour (rougher), and the scan is still saved.

**AI assistant:** the "Ask AI" button on every page opens a chat panel at the side. The `ask-agent` function sends the chat to Claude. It answers questions about diseases, fertilizer doses, sprays and watering in English, Telugu, Hindi or Kannada. It can use the farmer's latest scan, takes voice questions and reads answers aloud. Every question and answer is saved to the `agent_chats` table and shown under "Farmer questions" on `/admin`. Each phone can ask up to 40 questions an hour. Without the Claude key, the panel searches the disease library on the phone instead.

Set it up once:

1. Copy `.env.supabase.example` to `.env.supabase`. Fill in `SUPABASE_ACCESS_TOKEN` (from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)), `ADMIN_EMAIL`, and optionally `ANTHROPIC_API_KEY` (from [console.anthropic.com](https://console.anthropic.com/settings/keys)).
2. Run `npm run setup:supabase`. It creates the `patra-lens` project (Mumbai region), the `scans` table and the private `scan-photos` bucket. It also creates the admin account, deploys the `analyze-leaf` function and writes `.env.local`. It is safe to run again.
3. The admin email and generated password are in `admin-credentials.txt`. Sign in at `/admin`.
4. For the live site, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.local` to Vercel's environment variables, then redeploy.

How it is protected: the browser never writes to the table. Only the `analyze-leaf` function does, with the service key that stays on Supabase. Row-level security lets only users with `app_metadata.role = "admin"` read, edit or delete scans and photos. Each phone can send at most 60 scans an hour, which keeps Claude costs bounded. In Supabase's Table Editor, the `scans` table shows every scan, and Storage → `scan-photos` holds the photos.

## Kisan Hub (`/hub`)

A dark, mobile-first app inside the same site for farmers and labs. Open it from the "Kisan Hub" button in the header.

- **Login:** mobile number and OTP, with a Farmer or Expert/Lab role, then a one-time profile (state, district, village, acres, crops). The OTP is simulated for the demo: the code is shown on screen and no SMS is sent. Use an SMS provider before real use.
- **Dashboard:** weather advisories, the spray window, scan history, the best mandi price for each of the farmer's crops, and lab requests.
- **Kisan Vani:** a voice assistant in Telugu, Hindi, English, Tamil, Kannada and Malayalam. It uses the browser's speech recognition and speech synthesis, and gets its answers from `ask-agent` in voice mode. Greetings, "My diagnosis", "Weather alert" and "Crop plan" also work offline.
- **Crop Scanner:** tomato and paddy, by drag and drop or camera. It uses the same AI as `/scan`: red circles mark lesions, yellow circles mark dry or nutrient-starved tissue, and a table gives each box's coordinates. Every scan is saved with the farmer's name, phone, time and approximate location (about 1 km, or the district centre). Paddy needs the online AI; offline, only the colour circles are shown.
- **Mandi Prices:** AP, Telangana and Karnataka APMC markets, in ₹ per quintal, with trend badges and MSP alerts (kharif 2025-26). Prices are live from Agmarknet when `DATA_GOV_API_KEY` is set. Otherwise the page shows sample prices with a clear label.
- **Labs & RBK:** ICAR institutes, universities, KVKs, RBKs/Rythu Vedikas, RSKs and officers, searchable. Each entry has Call, WhatsApp, and "Send scan for review", which writes to the `escalations` table and shows up under "Lab requests" on `/admin`. Only the national helplines (KCC 1800-180-1551, PMFBY 14447) carry phone numbers. Other entries call KCC until a verified number is added in `src/hub/directory.ts`.
- **Weather & Spray:** a 7-day Open-Meteo forecast, rain, humidity, heat and wind alerts, and a 48-hour spray timeline.
- **Schemes:** a quick eligibility check for PM-KISAN, PMFBY, KCC, Soil Health Card, PM-KUSUM and state schemes (AP Annadata Sukhibhava, Telangana Rythu Bharosa, Karnataka Krishi Bhagya). It is a guide, with links to the official portals.
- **NPK Calculator:** crop, acres and soil test level give kg of N, P and K, then bags of DAP, urea and MOP, the approximate cost, and the split schedule.

**Voice Agent:** a glowing microphone button on every page, on both the main site and Kisan Hub. Tap it and speak in Telugu, Hindi, English, Tamil, Kannada or Malayalam.
- It answers aloud, using Claude through `ask-agent` in voice mode.
- It opens screens by voice, for example "open mandi", "మండి ధరలు చూపించు" or "मौसम दिखाओ".
- "Read this page" gives a voice-over of the current screen. Claude explains it in the farmer's language; offline, it reads a built-in intro.
- "Hands-free" keeps listening after each answer, and "stop" or "ధన్యవాదాలు" ends it. "Narrate each screen" speaks an intro whenever a screen opens.
- Commands and intros are in `src/hub/voiceAgent.ts`. The translations are drafts, so have native speakers check them.

Code: `src/hub/` (data and logic), `src/hub/pages/` (screens), `supabase/functions/kisan-hub` (live mandi prices and escalations), `supabase/migrations/0003_escalations.sql`. Have local experts check the directory, scheme amounts and fertilizer doses before real use.

## Admin login (Expert screen)

By default, the Expert screen asks for the admin's Gmail and a password. Only a SHA-256 hash of the two is in the code (`expert.adminLoginSha256` in `src/config.ts`, which also shows how to change it). This is a login for the demo: it does not contact Gmail or Google.

### Optional: real Google sign-in

Only the Gmail address whose SHA-256 hash is in `expert.adminEmailSha256` gets in.

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create a project, then an OAuth client ID of type "Web application".
2. Under "Authorized JavaScript origins", add the site's address and `http://localhost:5173`.
3. Set `VITE_GOOGLE_CLIENT_ID` to the client ID in Vercel, and in a `.env.local` file for local use, then rebuild. The client ID is not a secret.

The site has no server, so both logins run in the browser. Google sign-in verifies Google's signature, but someone able to edit the page's code in their own browser could get past either one. That only affects their own device, because all data stays on each device. If you add a shared database, enforce the admin check on the server too.

## Deploy

Vercel or Netlify, as a static site:

- Build command: `npm run build`
- Output folder: `dist`
- Rewrite all routes to `/index.html`. Vercel: add a `vercel.json` with `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`. Netlify: add a `public/_redirects` file containing `/* /index.html 200`.

## Add your own trained model (optional)

If `public/model/patra.onnx` exists, it is used instead of the free model and also gives a Grad-CAM heatmap.

1. Train with `ml/train_patra.py` (see `ml/README.md`). It makes `patra.onnx` with a built-in heatmap.
2. Put it at `public/model/patra.onnx`. Keep `labels.json` in the same class order, and put your fitted temperature in `calibration.json`.
3. The chip on the Scan page changes to "Model: on-device" and the heatmap label changes to "Where the model looked".
4. Replace the numbers in `measured` in `src/config.ts` with those from `METRICS.md`. The current numbers describe the free model.

To use a server, set `VITE_API_URL`. The order is: your model, then the free model, then server, then demo values (bundled samples only), then none. If the AI cannot load, a user's own photo gets photo checks only, never an invented diagnosis.

## Add real timeline photos

Put the photos in `public/samples/timeline/plant-a/` and list them in `public/samples/timeline/manifest.json`:

```json
{ "plants": [{ "name": "Plant A", "visits": [{ "date": "2026-10-30", "file": "plant-a/2026-10-30.jpg" }] }] }
```

With at least 2 visits listed, "Load demo plant" appears on Leaf Watch. Never add edited or fake photos.

## Change thresholds

Every threshold, weight and limit is in `src/config.ts`. Settings shows them read only. The rule text on the Risk page reads "adjustable in settings" because the spec asks for that wording, but changing a value means editing this file.

## Run the tests

```
npm run typecheck
npm test
```

`npm test` runs the risk, radar and answer-level rules. The kit's `tests/parity.test.ts` compares against the Python reference and needs a folder of reference images:

```
npx tsx tests/parity.test.ts <folder with work PNGs and python.json>
```

Expected numbers are in `reference/EXPECTED_RESULTS.md`.

## Project layout

```
src/app/              router and layout
src/pages/            one file per route
src/components/ui/    design system
src/components/viz/   phone frame, slider, rings, chart, recovery twin
src/lib/              kit algorithms (vision/, model.ts, risk.ts, radar.ts)
                      plus db.ts, i18n.tsx, ics.ts, diagnose.ts, watch.ts, weather.ts
src/config.ts         all thresholds
src/i18n/             English, Telugu and Kannada strings
ml/                   model training
reference/            Python reference and expected results
```

## Things to know

- **Keep OpenCV on 4.12.** `@techstark/opencv-js` is pinned on purpose. Version 5.0 removed `cv.matFromImageData`, which the alignment code needs.
- **Photo Coach measures the original photo**, before it is shrunk for storage. A re-encoded JPEG reads 20–50% sharper.
- **Port 5173 is fixed.** If it is busy, Vite stops with an error instead of quietly moving to another port. Change it in `vite.config.ts`.
- **No "where the model looked" heatmap with the free model.** The overlay is the colour-based spot mask and is labelled so. Grad-CAM needs your own `patra.onnx`.
- **Not built:** the optional shared radar database (spec section 10). Radar uses sample data and this device's own reports.
- **Telugu and Kannada are drafts.** Ask native speakers to check them before release.
