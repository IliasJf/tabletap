"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";

const RESEND_AFTER_S = 60;

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

/** Two steps: email, then the 6-digit code we send to it. */
export default function SignInPanel({
  onSignedIn,
}: {
  onSignedIn: () => void;
}) {
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
      setError(cause instanceof Error ? cause.message : "Please try again.");
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
      setError(cause instanceof Error ? cause.message : "Please try again.");
      setBusy(false);
    }
  }

  return (
    <section className="admin-signin">
      <div>
        <h2>A home for your own menu.</h2>
        <p>
          Explore the demo below. Sign in with your email to edit dishes, set up
          WhatsApp orders, and save a menu that belongs to your restaurant. No
          password needed.
        </p>
      </div>
      {step === "email" ? (
        <form className="admin-signin-form" onSubmit={sendCode}>
          <label className="admin-field">
            Your email
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
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form className="admin-signin-form" onSubmit={verify}>
          <label className="admin-field">
            6-digit code
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
            <small>
              We sent it to <strong>{email}</strong>. It expires in 10 minutes.
            </small>
          </label>
          {devCode && (
            <p className="admin-notice" role="status">
              Email isn&apos;t connected here, so here is your code:{" "}
              <strong>{devCode}</strong>
            </p>
          )}
          <button
            type="submit"
            className="admin-primary"
            disabled={busy || code.length !== 6}
          >
            {busy ? "Checking…" : "Sign in"}
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
              Use another email
            </button>
            <button
              type="button"
              className="admin-text-button"
              disabled={busy || wait > 0}
              onClick={() => void sendCode()}
            >
              {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
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
