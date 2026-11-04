// Waits for ANTHROPIC_API_KEY (and optionally DATA_GOV_API_KEY) to appear in .env.supabase, then stores them as
// Supabase function secrets, so AI vision, the AI assistant and live mandi prices switch on without a redeploy.
// Run: node scripts/watch-claude-key.mjs   (stops after 2 hours, or once the keys are installed)
import { existsSync, readFileSync } from "node:fs";

const read = () => Object.fromEntries((existsSync(".env.supabase") ? readFileSync(".env.supabase", "utf8") : "").split(/\r?\n/)
  .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));

const installed = new Set();
const deadline = Date.now() + 2 * 3600_000;
while (Date.now() < deadline) {
  const env = read();
  const ref = env.SUPABASE_PROJECT_REF, token = env.SUPABASE_ACCESS_TOKEN;
  const todo = ["ANTHROPIC_API_KEY", "DATA_GOV_API_KEY"].filter((k) => env[k] && !installed.has(k));
  if (ref && token && todo.length) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(todo.map((name) => ({ name, value: env[name] }))),
    });
    if (r.ok) { todo.forEach((k) => installed.add(k)); console.log(`installed: ${todo.join(", ")}`); }
    else console.log(`could not install (${r.status}); will retry`);
  }
  if (installed.has("ANTHROPIC_API_KEY")) break;
  await new Promise((res) => setTimeout(res, 5000));
}
console.log(installed.size ? "done" : "no key added within 2 hours");
