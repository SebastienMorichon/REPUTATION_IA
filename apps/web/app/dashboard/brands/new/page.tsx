"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, type Brand } from "@/lib/api";

export default function NewBrandPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    domain: "",
    category: "",
    country: "FR",
    language: "fr",
    description: "",
    aliases: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        domain: form.domain || null,
        category: form.category || null,
        country: form.country || null,
        language: form.language || null,
        description: form.description || null,
        aliases: form.aliases
          ? form.aliases.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
      };
      const brand = await apiFetch<Brand>("/brands", {
        method: "POST",
        body: JSON.stringify(body),
      });
      router.push(`/dashboard/brands/${brand.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Nouvelle marque</h1>
      <div>
        <label className="label">Nom de la marque *</label>
        <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Domaine</label>
          <input className="input" value={form.domain} onChange={(e) => update("domain", e.target.value)} placeholder="example.com" />
        </div>
        <div>
          <label className="label">Catégorie</label>
          <input className="input" value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="SaaS, e-commerce…" />
        </div>
        <div>
          <label className="label">Pays</label>
          <input className="input" value={form.country} onChange={(e) => update("country", e.target.value)} />
        </div>
        <div>
          <label className="label">Langue</label>
          <input className="input" value={form.language} onChange={(e) => update("language", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Description courte</label>
        <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => update("description", e.target.value)} />
      </div>
      <div>
        <label className="label">Alias (séparés par des virgules)</label>
        <input className="input" value={form.aliases} onChange={(e) => update("aliases", e.target.value)} placeholder="Ma Marque, MaMarque.io" />
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Création…" : "Créer la marque"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Annuler</button>
      </div>
    </form>
  );
}
