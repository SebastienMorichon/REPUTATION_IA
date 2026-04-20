"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, setToken, type AuthResponse } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-semibold text-text">AI Reputation Shield</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-text">Se connecter</h1>
            <p className="mt-1 text-sm text-muted">Accédez à votre tableau de bord.</p>
          </div>

          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input className="input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>

          {error && (
            <div className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
              {error}
            </div>
          )}

          <button className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          <p className="text-center text-sm text-muted">
            Pas de compte ?{" "}
            <Link href="/signup" className="font-medium text-text underline underline-offset-2 hover:opacity-70">
              Créer un compte
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
