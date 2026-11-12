// Privacy, terms and methodology. These describe what the app actually does.
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PHOTO_CREDIT, REFERENCES } from "../components/Footer";
import { CONFIG } from "../config";

const UPDATED = "31 October 2026";
const pct = (v: number | null) => (v === null ? "not measured" : `${Math.round(v * 100)}%`);

const Page = ({ title, children }: { title: string; children: ReactNode }) => (
  <article className="wrap max-w-3xl py-8 md:py-12">
    <h1 className="page-title">{title}</h1>
    <p className="small mt-1">Last updated {UPDATED}</p>
    <div className="mt-6 space-y-6 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-forest [&_li]:mt-1.5 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:font-semibold [&_a]:text-green-dark [&_a]:underline">{children}</div>
  </article>
);

export function Privacy() {
  return (
    <Page title="Privacy">
      <p>There are no accounts for farmers, and nothing to sign up for.</p>
      <section><h2>What we save when you scan</h2>
        <p>Each photo you scan on the Scan page is sent to the Patra Chain database (hosted on Supabase) with its result, a random ID for your phone, and the name, phone number and village you choose to enter. Our team uses it to check answers and follow up with farmers. Only Patra Chain admins can see it.</p>
        <p>To find and circle the problem spots, the photo is also sent to Anthropic's Claude AI. Anthropic does not use it to train its models.</p>
        <p>To have your scans removed from the database, contact the Patra Chain team.</p>
      </section>
      <section><h2>What stays on your device</h2>
        <p>Your fields, sentinel plants, Leaf Watch photos, notes and settings are saved in your browser's storage on your device. A copy of each scan is kept there too.</p>
        <p>You can export everything, or delete everything on this device, in <Link to="/settings">Settings</Link>.</p>
      </section>
      <section><h2>What is sent to other services</h2>
        <p>To show weather, places, maps and descriptions, your browser asks these free services directly:</p>
        <ul>
          <li><strong>Open-Meteo</strong> for weather and soil moisture. It receives a rounded location, which is your approximate 1 km area, or Bengaluru if you have not shared your area.</li>
          <li><strong>BigDataCloud</strong> for the name of your area, with the same rounded location.</li>
          <li><strong>SoilGrids (ISRIC)</strong> for soil nutrients, only when you tap the button to load them, with the same rounded location.</li>
          <li><strong>Wikipedia</strong> for disease descriptions. It receives the name of the page being read.</li>
          <li><strong>OpenStreetMap</strong> for map tiles. It receives your IP address and the part of the map you are viewing.</li>
          <li><strong>Google Fonts</strong> for the typefaces. It receives your IP address.</li>
          <li><strong>Google sign-in</strong>, only if an admin signs in with it.</li>
        </ul>
        <p>The site is hosted on Vercel, which keeps standard server logs, such as IP addresses, as most hosts do.</p>
      </section>
      <section><h2>Your location</h2>
        <p>Location is optional and off by default. If you turn on area sharing, your phone's location is rounded to a square about 1 km wide before anything is saved. Your exact coordinates are never stored, sent or shown.</p>
      </section>
      <section><h2>What we do not do</h2>
        <ul><li>No advertising and no analytics trackers.</li><li>No selling of your data.</li><li>No tracking cookies.</li></ul>
      </section>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms of use">
      <section><h2>What Patra Chain is</h2>
        <p>Patra Chain is a free tool that looks at photos of plant leaves and gives guidance. It is not a doctor for plants, and it does not replace an agriculture expert.</p>
      </section>
      <section><h2>Use your own judgement</h2>
        <ul>
          <li>Answers can be wrong. The AI was right about {pct(CONFIG.measured.fieldAccuracy)} of the time on public field photos it had not seen, and less for tomato ({pct(CONFIG.measured.tomatoFieldAccuracy)}). It has not been tested on farms.</li>
          <li>Fertilizer amounts are approximate figures from university recommendations. A soil test gives better numbers.</li>
          <li>Treatment notes are general guidance. Always follow the product label and local rules, and confirm with your Krishi Vigyan Kendra (KVK) or an agriculture officer before you act.</li>
          <li>Risk scores and weather alerts are estimates, not forecasts you can rely on.</li>
        </ul>
      </section>
      <section><h2>No warranty</h2>
        <p>Patra Chain is provided "as is". We do not promise that it will always be available or free from errors. To the extent the law allows, we are not responsible for crop losses or other damage that follows from using it.</p>
      </section>
      <section><h2>Third-party data and licences</h2>
        <p>Weather, maps, soil data and descriptions come from other services, each under its own terms. The AI model and photos are used under open licences. See <Link to="/about">Credits and licences</Link>.</p>
      </section>
      <section><h2>Changes</h2><p>We may change these terms. The date at the top shows the latest version.</p></section>
    </Page>
  );
}

export function Methodology() {
  const m = CONFIG.measured, c = CONFIG.coach;
  return (
    <Page title="How it works">
      <p>This page explains how each answer is produced, and how much to trust it.</p>
      <section><h2>1. Photo check</h2>
        <p>Before any answer, the app measures sharpness, light and how much of the photo is leaf. A photo needs sharpness of at least {c.minSharpness}, an average brightness between {c.minLuma} and {c.maxLuma}, and at least {c.minLeafPct}% leaf. Otherwise it asks for a retake.</p>
      </section>
      <section><h2>2. The AI</h2>
        <p>A free vision model, DINOv2, runs on your device and recognises {27} conditions on 13 plants. We kept its vision and retrained its last layer on PlantDoc field photos, because the model as downloaded did much worse on real field photos than on clean lab photos.</p>
        <ul>
          <li>Top answer right on {m.fieldTestPhotos} field photos it had never seen: {pct(m.fieldAccuracy)} (likely range {pct(m.fieldAccuracyLow)} to {pct(m.fieldAccuracyHigh)}).</li>
          <li>Right answer within its top 3: {pct(m.fieldTop3)}.</li>
          <li>Tomato alone: {pct(m.tomatoFieldAccuracy)}. The model before retraining: {pct(m.offTheShelfFieldAccuracy)}.</li>
          <li>Confidence error after calibration: {m.eceAfterCalibration}. This measures whether "70% sure" really means right about 70% of the time. Lower is better.</li>
        </ul>
        <p>The answer is labelled clear when one answer stands out, "check both" when two are close, and "not sure" when the top answer is below {Math.round(CONFIG.diagnosis.expertBelow * 100)}%.</p>
        <p><strong>Limits.</strong> These are public photos, not photos from local farms. A plant outside the 13 can get a confident wrong answer. A healthy tomato leaf is often called diseased.</p>
      </section>
      <section><h2>3. Leaf Watch</h2>
        <p>Each new photo is lined up with the last one using image features. Colour rules then find spots and holes that were not there before. This step does not use the AI. Faint spots can be missed and shadows can be counted, so always look at the leaf yourself.</p>
      </section>
      <section><h2>4. Risk score and alerts</h2>
        <p>The risk score applies simple, visible rules to the Open-Meteo forecast and to nearby confirmed reports. For late blight it adapts the Hutton criteria used for potato late blight in Great Britain. Weather alerts flag a day with at least {CONFIG.alerts.rainMmDay} mm of rain, a temperature of {CONFIG.alerts.heatC} °C or more, or {CONFIG.alerts.humidHoursDay} or more very humid hours. These are plain thresholds, not official warnings.</p>
      </section>
      <section><h2>5. Fertilizer and treatment guidance</h2>
        <p>Fertilizer amounts for tomato, potato and corn come from Tamil Nadu Agricultural University (TNAU) recommendations, for a whole crop in a normal season. Other advice comes from the extension and research sources linked next to it. Advice for a specific disease is shown only when one answer stands out. We do not name pesticide products or doses.</p>
      </section>
      <section><h2>6. Neighbourhood radar</h2>
        <p>Only confirmed scans from people who turned on area sharing count. Areas are about 1 km wide, and a count below {CONFIG.radar.minReportsToShowNumber} shows as "a few reports". An area is flagged when it has at least {CONFIG.radar.riseMinThisWeek} reports of one disease this week, and at least {CONFIG.radar.riseFactor} times the weekly average of the previous {CONFIG.radar.previousWeeks} weeks.</p>
      </section>
      <section><h2>Sources</h2>
        <ul>{REFERENCES.map(([n, h]) => <li key={h}><a href={h} target="_blank" rel="noreferrer">{n}</a></li>)}</ul>
        <p className="small">{PHOTO_CREDIT}</p>
      </section>
    </Page>
  );
}
