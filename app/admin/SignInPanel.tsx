"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { useAdminCopy } from "./admin-copy";

const RESEND_AFTER_S = 60;

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "");
  return data;
}

/** Two steps: email, then the 6-digit code we send to it. */
export default function SignInPanel({
  onSignedIn,
}: {
  onSignedIn: () => void;
}) {
  const { t } = useAdminCopy();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await post<{ devCode?: string }>("/api/auth/request-code", {
        email,
      });
      setDevCode(data.devCode ?? "");
      setCode("");
      setStep("code");
      setWait(RESEND_AFTER_S);
      setTimeout(() => codeInput.current?.focus(), 0);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message ? cause.message : t.tryAgain,
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/api/auth/verify", { email, code });
      onSignedIn();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message ? cause.message : t.tryAgain,
      );
      setBusy(false);
    }
  }

  return (
    <section className="admin-signin">
      <div>
        <h2>{t.signInTitle}</h2>
        <p>{t.signInIntro}</p>
      </div>
      {step === "email" ? (
        <form className="admin-signin-form" onSubmit={sendCode}>
          <label className="admin-field">
            {t.yourEmail}
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              maxLength={254}
              placeholder="you@your-cafe.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button type="submit" className="admin-primary" disabled={busy}>
            <Mail size={16} />
            {busy ? t.sending : t.emailMeCode}
          </button>
        </form>
      ) : (
        <form className="admin-signin-form" onSubmit={verify}>
          <label className="admin-field">
            {t.codeLabel}
            <input
              ref={codeInput}
              className="admin-code-input"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <small>{t.codeSent(email)}</small>
          </label>
          {devCode && (
            <p className="admin-notice" role="status">
              {t.codeShown} <strong>{devCode}</strong>
            </p>
          )}
          <button
            type="submit"
            className="admin-primary"
            disabled={busy || code.length !== 6}
          >
            {busy ? t.checking : t.signIn}
            <ArrowRight size={16} />
          </button>
          <div className="admin-signin-links">
            <button
              type="button"
              className="admin-text-button"
              onClick={() => {
                setStep("email");
                setError("");
              }}
            >
              <ArrowLeft size={14} />
              {t.otherEmail}
            </button>
            <button
              type="button"
              className="admin-text-button"
              disabled={busy || wait > 0}
              onClick={() => void sendCode()}
            >
              {wait > 0 ? t.newCodeIn(wait) : t.newCode}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="admin-error admin-signin-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
