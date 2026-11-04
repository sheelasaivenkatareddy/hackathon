// One-time cloud setup. Run: npm run setup:supabase
// Reads .env.supabase (never committed) and then, safely re-runnable:
//  1. finds or creates the Supabase project
//  2. creates the scans table, the private photo bucket and the admin-only rules
//  3. creates (or resets) the admin account
//  4. stores the Claude key as a function secret and deploys the analyze-leaf function
//  5. writes .env.local with the public URL and key for the website
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const API = "https://api.supabase.com/v1";
const ENV_FILE = ".env.supabase";

function readEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
}

const env = { ...readEnv(ENV_FILE), ...process.env };
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error(`Missing SUPABASE_ACCESS_TOKEN. Copy .env.supabase.example to ${ENV_FILE} and fill it in.`);
  process.exit(1);
}
const PROJECT_NAME = env.SUPABASE_PROJECT_NAME || "patra-lens";
const REGION = env.SUPABASE_REGION || "ap-south-1"; // Mumbai
const ADMIN_EMAIL = (env.ADMIN_EMAIL || "").trim().toLowerCase();
if (!ADMIN_EMAIL) { console.error(`Set ADMIN_EMAIL in ${ENV_FILE}.`); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, init = {}) {
  const r = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${r.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
const step = (s) => console.log(`\n> ${s}`);

// 1. project
step("Finding the Supabase project");
let project;
if (env.SUPABASE_PROJECT_REF) project = await api(`/projects/${env.SUPABASE_PROJECT_REF}`);
else project = (await api("/projects")).find((p) => p.name === PROJECT_NAME);
if (!project) {
  const orgs = await api("/organizations");
  if (!orgs.length) throw new Error("Your Supabase account has no organization. Create one at supabase.com/dashboard first.");
  const dbPass = randomBytes(18).toString("base64url");
  console.log(`  Creating project "${PROJECT_NAME}" in ${REGION} (organization ${orgs[0].name})`);
  project = await api("/projects", { method: "POST", body: JSON.stringify({ name: PROJECT_NAME, organization_id: orgs[0].id, region: REGION, db_pass: dbPass }) });
  writeFileSync(".supabase-db-password.txt", `Database password for ${PROJECT_NAME} (${project.id}): ${dbPass}\n`);
}
const REF = project.id ?? project.ref;
console.log(`  Project ${REF}`);
for (let i = 0; ; i++) {
  const p = await api(`/projects/${REF}`);
  if (p.status === "ACTIVE_HEALTHY") break;
  if (i > 90) throw new Error(`Project is still ${p.status} after 15 minutes.`);
  if (i % 6 === 0) console.log(`  Waiting for the project to start (${p.status})…`);
  await sleep(10_000);
}
const URL_ = `https://${REF}.supabase.co`;

// API keys (the database can take a moment to accept queries after it reports healthy)
const keys = await api(`/projects/${REF}/api-keys?reveal=true`);
const keyOf = (name) => keys.find((k) => k.name === name)?.api_key;
const ANON = keyOf("anon"), SERVICE = keyOf("service_role");
if (!ANON || !SERVICE) throw new Error("Could not read the project's anon and service_role keys.");

// 2. schema
step("Creating the scans table, photo bucket and admin rules");
const sql = readFileSync("supabase/migrations/0001_scans.sql", "utf8");
for (let i = 0; ; i++) {
  try { await api(`/projects/${REF}/database/query`, { method: "POST", body: JSON.stringify({ query: sql }) }); break; }
  catch (e) { if (i > 11) throw e; await sleep(10_000); }
}

// 3. admin account
step(`Creating the admin account ${ADMIN_EMAIL}`);
const auth = (path, init = {}) => fetch(`${URL_}/auth/v1${path}`, { ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" } });
const password = env.ADMIN_PASSWORD || randomBytes(12).toString("base64url");
const user = { email: ADMIN_EMAIL, password, email_confirm: true, app_metadata: { role: "admin" } };
let res = await auth("/admin/users", { method: "POST", body: JSON.stringify(user) });
if (!res.ok) {
  const list = await (await auth("/admin/users?per_page=1000")).json();
  const existing = (list.users ?? []).find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
  if (!existing) throw new Error(`Could not create the admin: ${res.status} ${await res.text()}`);
  res = await auth(`/admin/users/${existing.id}`, { method: "PUT", body: JSON.stringify({ password, app_metadata: { role: "admin" }, email_confirm: true }) });
  if (!res.ok) throw new Error(`Could not update the admin: ${res.status} ${await res.text()}`);
}
writeFileSync("admin-credentials.txt", `Patra Lens admin (sign in at /admin)\nEmail: ${ADMIN_EMAIL}\nPassword: ${password}\nSupabase dashboard: https://supabase.com/dashboard/project/${REF}\n`);

// 4. function + Claude key
step("Deploying the analyze-leaf function");
if (env.ANTHROPIC_API_KEY) {
  await api(`/projects/${REF}/secrets`, { method: "POST", body: JSON.stringify([{ name: "ANTHROPIC_API_KEY", value: env.ANTHROPIC_API_KEY }]) });
  console.log("  Claude key stored as a function secret.");
} else {
  console.log("  No ANTHROPIC_API_KEY: scans will use the on-phone AI and still be saved. Add the key and re-run to turn on AI vision.");
}
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
execFileSync(npx, ["--yes", "supabase@3.0.0", "functions", "deploy", "analyze-leaf", "--project-ref", REF, "--no-verify-jwt", "--use-api"],
  { stdio: "inherit", env: { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN }, shell: process.platform === "win32" });

// 5. website settings
step("Writing .env.local for the website");
const local = existsSync(".env.local") ? readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !/^VITE_SUPABASE_(URL|ANON_KEY)=/.test(l)) : [];
writeFileSync(".env.local", [...local, `VITE_SUPABASE_URL=${URL_}`, `VITE_SUPABASE_ANON_KEY=${ANON}`, ""].join("\n"));

console.log(`\nDone.\n  Website keys: .env.local\n  Admin login:  admin-credentials.txt (email ${ADMIN_EMAIL})\n  Dashboard:    https://supabase.com/dashboard/project/${REF}/editor`);
