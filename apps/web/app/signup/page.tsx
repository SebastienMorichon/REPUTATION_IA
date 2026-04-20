"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, setToken, type AuthResponse } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", full_name: "", org: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name || null,
          organization_name: form.org || null,
        }),
      });
      setToken(res.access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
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
            <h1 className="text-xl font-semibold text-text">Créer un compte</h1>
            <p className="mt-1 text-sm text-muted">Commencez à surveiller en 30 secondes.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nom complet</label>
              <input className="input" value={form.full_name} onChange={update("full_name")} />
            </div>
            <div>
              <label className="label">Organisation</label>
              <input className="input" value={form.org} onChange={update("org")} placeholder="Mon entreprise" />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={update("email")} required />
          </div>
          <div>
            <label className="label">Mot de passe (8+ car.)</label>
            <input className="input" type="password" minLength={8} value={form.password} onChange={update("password")} required />
          </div>

          {error && (
            <div className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
              {error}
            </div>
          )}

          <button className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? "Création…" : "Créer mon compte"}
          </button>

          <p className="text-center text-sm text-muted">
            Déjà un compte ?{" "}
            <Link href="/login" className="font-medium text-text underline underline-offset-2 hover:opacity-70">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
