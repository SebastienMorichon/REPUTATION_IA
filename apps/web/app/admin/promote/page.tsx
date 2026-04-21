"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function PromoteAdminPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      await apiFetch("/auth/admin/promote", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(`✅ L'utilisateur ${email} est maintenant administrateur.`);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la promotion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-text">Promouvoir administrateur</h1>
      <p className="mt-1 text-sm text-muted">
        Ajouter les droits admin à un utilisateur existant.
      </p>

      <form onSubmit={onSubmit} className="mt-6 card space-y-4">
        <div>
          <label className="label">Email de l'utilisateur</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="exemple@domain.com"
            required
          />
        </div>

        {message && (
          <div className="rounded-xl border border-good/30 bg-good/10 px-3 py-2 text-sm text-good">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary w-full py-2.5"
          disabled={loading}
        >
          {loading ? "Promotion..." : "Promouvoir administrateur"}
        </button>
      </form>
    </div>
  );
}
