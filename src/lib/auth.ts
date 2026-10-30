// Admin sign-in with Google (free). The site has no server, so this runs in the browser:
// it checks Google's signature on the ID token, then compares a hash of the email with config.ts.
// It locks the admin screen. It cannot protect data the way a server would, and there is no shared data to protect.
import { CONFIG } from "../config";

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || "";
const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const STORE_KEY = "patra-admin-token";

const b64urlBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const b64urlJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

async function sha256Hex(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type SignInResult = { ok: true; email: string } | { ok: false; reason: "not-admin" | "invalid" | "network" };

export async function checkAdminToken(token: string): Promise<SignInResult> {
  try {
    const [h, p, sig] = token.split(".");
    if (!h || !p || !sig) return { ok: false, reason: "invalid" };
    const header = b64urlJson(h), claims = b64urlJson(p);
    if (header.alg !== "RS256") return { ok: false, reason: "invalid" };

    let keys: JsonWebKey[];
    try { keys = (await (await fetch(CERTS_URL)).json()).keys; } catch { return { ok: false, reason: "network" }; }
    const jwk = keys.find((k) => (k as JsonWebKey & { kid?: string }).kid === header.kid);
    if (!jwk) return { ok: false, reason: "invalid" };
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signed = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(sig), new TextEncoder().encode(`${h}.${p}`));
    if (!signed) return { ok: false, reason: "invalid" };

    const fromGoogle = claims.iss === "accounts.google.com" || claims.iss === "https://accounts.google.com";
    if (!fromGoogle || claims.aud !== GOOGLE_CLIENT_ID || claims.exp * 1000 <= Date.now()) return { ok: false, reason: "invalid" };
    if (claims.email_verified !== true || typeof claims.email !== "string") return { ok: false, reason: "not-admin" };
    if ((await sha256Hex(claims.email.trim().toLowerCase())) !== CONFIG.expert.adminEmailSha256) return { ok: false, reason: "not-admin" };
    return { ok: true, email: claims.email };
  } catch (e) {
    console.warn("Sign-in check failed", e);
    return { ok: false, reason: "invalid" };
  }
}

export const saveSession = (token: string) => { try { sessionStorage.setItem(STORE_KEY, token); } catch { /* the sign-in still works until reload */ } };
export const clearSession = () => { try { sessionStorage.removeItem(STORE_KEY); } catch { /* nothing stored */ } };

/** Keeps the admin signed in across a reload, in this tab, until Google's token expires. */
export async function restoreSession(): Promise<string | null> {
  let token: string | null = null;
  try { token = sessionStorage.getItem(STORE_KEY); } catch { return null; }
  if (!token) return null;
  const r = await checkAdminToken(token);
  if (r.ok) return r.email;
  if (r.reason !== "network") clearSession();
  return null;
}

let gis: Promise<any> | null = null;
export function loadGoogle(): Promise<any> {
  if (!gis) {
    gis = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve((window as any).google);
      s.onerror = () => { gis = null; reject(new Error("Could not load Google sign-in")); };
      document.head.appendChild(s);
    });
  }
  return gis;
}
