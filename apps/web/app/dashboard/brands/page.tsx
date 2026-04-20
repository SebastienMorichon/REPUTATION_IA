"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, type Brand } from "@/lib/api";

export default function BrandsList() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Brand[]>("/brands")
      .then(setBrands)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Toutes les marques</h1>
        <Link href="/dashboard/brands/new" className="btn-primary">+ Nouvelle marque</Link>
      </div>
      {loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : brands.length === 0 ? (
        <p className="text-sm text-muted">Aucune marque.</p>
      ) : (
        <div className="card divide-y divide-border p-0">
          {brands.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/brands/${b.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-panel/60"
            >
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-muted">{b.domain || "—"}</div>
              </div>
              <span className="text-xs text-muted">{b.category || ""}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
