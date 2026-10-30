// Node tests for risk rules, radar rules, answer levels and model pre-processing.
// Run:  npx tsx tests/rules.test.ts <public folder> [<parity folder with model_python.json>]
// Needs: npm i -D tsx sharp onnxruntime-web
import fs from "node:fs";
import path from "node:path";
import { computeRisk, OpenMeteo } from "../src/lib/risk";
import { cellId, displayCount, nearbyThisWeek, unusualRises, Report } from "../src/lib/radar";
import { answerLevel, confidenceWord, DEMO_RESULTS, preprocess, softmax } from "../src/lib/model";

const pub = process.argv[2], parity = process.argv[3];
let failures = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures++; };

// ---------------------------------------------------------------- weather scenarios (IST, 6 days of hours)
function weather(fn: (day: number, hour: number) => { t: number; rh: number; mm: number }): OpenMeteo {
  const time: string[] = [], t: number[] = [], rh: number[] = [], mm: number[] = [];
  for (let d = 0; d < 6; d++) for (let h = 0; h < 24; h++) {
    const date = new Date(Date.UTC(2026, 9, 27 + d, h)).toISOString().slice(0, 16);
    const v = fn(d, h); time.push(date); t.push(v.t); rh.push(v.rh); mm.push(v.mm);
  }
  return { utc_offset_seconds: 19800, hourly: { time, temperature_2m: t, relative_humidity_2m: rh, precipitation: mm } };
}
const now = new Date("2026-10-30T05:00:00Z"); // 10:30 in India; days: 27,28,29 past, 30 today, 31 and 1 forecast
const night = (h: number) => h < 6 || h >= 20; // 10 humid hours per day
const coolWet = weather((d, h) => ({ t: night(h) ? 12 : 18, rh: d >= 1 && night(h) ? 93 : 70, mm: 0 }));
const warmWet = weather((d, h) => ({ t: night(h) ? 22 : 28, rh: (d === 1 || d === 2) && (night(h) || h < 9) ? 94 : 65, mm: d >= 1 && d <= 3 && h === 8 ? 2 : 0 }));
const dry = weather(() => ({ t: 27, rh: 55, mm: 0 }));

let r = computeRisk(coolWet, "vegetative", {}, now);
check(r.today === "2026-10-30", `today is ${r.today}`);
check(r.groups[0].score === 65 && r.groups[0].level === "high", `cool & wet: late blight ${r.groups[0].score} ${r.groups[0].level} (expect 65 high)`);
check(r.groups[1].score === 0, `cool & wet: leaf spots ${r.groups[1].score} (expect 0)`);
check(r.scoutEveryDays === 2, `cool & wet: check every ${r.scoutEveryDays} days (expect 2)`);
r = computeRisk(warmWet, "fruiting", { "Early blight": 2, "Septoria leaf spot": 1 }, now);
check(r.groups[1].score === 80 && r.groups[1].level === "high", `warm & wet: leaf spots ${r.groups[1].score} ${r.groups[1].level} (expect 80 high) | ${r.groups[1].rules.map((x) => x.met ? "Y" : "n").join("")}`);
check(r.groups[0].score === 50 && r.groups[0].level === "medium", `warm & wet: late blight ${r.groups[0].score} (expect 50 medium, Hutton met)`);
r = computeRisk(dry, "flowering", {}, now);
check(r.overall.level === "low" && r.overall.score === 10 && r.scoutEveryDays === 5, `dry: overall ${r.overall.score} ${r.overall.level}, every ${r.scoutEveryDays} days (expect 10 low, 5)`);
check(r.days.length === 5 && r.days[2].date === "2026-10-30" && r.days[0].past, "outlook covers 2 past days, today and 2 forecast days");

// ---------------------------------------------------------------- radar
const sample = JSON.parse(fs.readFileSync(path.join(pub, "data/sample-reports.json"), "utf8"));
const reports: Report[] = sample.reports;
const rises = unusualRises(reports);
check(rises.length === 1 && rises[0].disease === "Early blight" && rises[0].thisWeek === 5 && rises[0].previousWeeklyAverage === 0.67,
  `sample data: ${rises.length} unusual rise(s): ${JSON.stringify(rises.map((x) => [x.disease, x.centreCell, x.thisWeek, x.previousWeeklyAverage]))}`);
check(nearbyThisWeek(reports, "1297_7762")["Early blight"] === 5, "nearby early blight this week around 1297_7762 = 5");
check(displayCount(2) === "A few reports" && displayCount(3) === 3, "fewer than 3 reports show 'A few reports'");
check(cellId(12.9716, 77.5946) === "1297_7759", `cellId(12.9716, 77.5946) = ${cellId(12.9716, 77.5946)}`);

// ---------------------------------------------------------------- answer levels on the demo values
const expected: Record<string, [string, string]> = {
  "early-blight-closeup.jpg": ["CLEAR", "high"], "early-blight-field.jpg": ["CLEAR", "medium"], "septoria-closeup.jpg": ["CHECK", "medium"],
  "septoria-field.jpg": ["CLEAR", "medium"], "late-blight-field.jpg": ["EXPERT", "low"], "healthy-leaf.jpg": ["CLEAR", "high"], "early-blight-lab.jpg": ["CLEAR", "high"],
};
for (const [f, [lvl, word]] of Object.entries(expected)) {
  const t = DEMO_RESULTS[f];
  check(answerLevel(t, true) === lvl && confidenceWord(t[0].p) === word, `demo ${f}: ${answerLevel(t, true)} ${confidenceWord(t[0].p)} (expect ${lvl} ${word})`);
}
check(answerLevel(DEMO_RESULTS["healthy-leaf.jpg"], false) === "RETAKE" && answerLevel(DEMO_RESULTS["healthy-leaf.jpg"], false, true) === "CLEAR",
  "failed photo check gives RETAKE unless 'Use anyway'");
const p = softmax([2, 1, 0], 2);
check(Math.abs(p[0] - 0.506) < 0.001, `softmax with temperature 2: ${Array.from(p).map((v) => v.toFixed(3))}`);

// ---------------------------------------------------------------- pre-processing parity with torchvision (optional)
(async () => {
  if (parity && fs.existsSync(path.join(parity, "model_python.json"))) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require("sharp"), ort = require("onnxruntime-web");
    ort.env.wasm.numThreads = 1;
    const py = JSON.parse(fs.readFileSync(path.join(parity, "model_python.json"), "utf8"));
    const sess = await ort.InferenceSession.create(fs.readFileSync(path.join(parity, "patra-smoke.onnx")), { executionProviders: ["wasm"] });
    for (const [name, exp] of Object.entries<any>(py)) {
      const { data, info } = await sharp(path.join(parity, `${name}-full.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const { data: x, cropBox } = preprocess({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) });
      const ref = new Float32Array(fs.readFileSync(path.join(parity, `${name}-tensor.bin`)).buffer.slice(0));
      let sum = 0, mx = 0;
      for (let i = 0; i < x.length; i++) { const d = Math.abs(x[i] - ref[i]); sum += d; mx = Math.max(mx, d); }
      const out = await sess.run({ input: new ort.Tensor("float32", x, [1, 3, 224, 224]) });
      const lg = Array.from(out.logits.data as Float32Array), top1 = lg.indexOf(Math.max(...lg));
      const ld = Math.max(...lg.map((v, i) => Math.abs(v - exp.logits[i])));
      check(sum / x.length < 0.02 && top1 === exp.top1, `preprocess ${name}: mean |diff| ${(sum / x.length).toFixed(4)} (max ${mx.toFixed(3)}), logits max diff ${ld.toFixed(4)}, top1 ${top1}/${exp.top1}, crop ${JSON.stringify(cropBox)}`);
    }
  }
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})();
