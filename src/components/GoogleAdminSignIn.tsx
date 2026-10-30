import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID, checkAdminToken, loadGoogle, saveSession } from "../lib/auth";

const MESSAGES = {
  "not-admin": "This Google account is not the admin.",
  invalid: "That sign-in could not be verified. Please try again.",
  network: "Sign-in needs internet. Please connect and try again.",
  load: "Google sign-in could not load. Check your internet and try again.",
};

export default function GoogleAdminSignIn({ onAdmin }: { onAdmin: (email: string) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<keyof typeof MESSAGES | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let live = true;
    loadGoogle().then((google) => {
      if (!live || !slot.current) return;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }: { credential: string }) => {
          setChecking(true); setError(null);
          const r = await checkAdminToken(credential);
          if (!live) return;
          setChecking(false);
          if (r.ok) { saveSession(credential); onAdmin(r.email); } else setError(r.reason);
        },
      });
      google.accounts.id.renderButton(slot.current, { theme: "outline", size: "large", shape: "pill", text: "signin_with" });
    }).catch(() => { if (live) setError("load"); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h2 className="h3">Admin sign-in</h2>
      <p className="small mt-1">Only the admin's Google account can review cases and download labelled data.</p>
      <div ref={slot} className="mt-3 min-h-[44px]" data-testid="google-button" />
      {checking && <p role="status" className="small mt-2">Checking your account…</p>}
      {error && <p role="alert" data-testid="signin-error" className="mt-2 text-sm font-semibold text-tomato-dark">{MESSAGES[error]}</p>}
    </div>
  );
}
