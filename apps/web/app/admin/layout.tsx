"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const [checking, setChecking] = useState(true);
  const [denied,   setDenied]   = useState(false);

  useEffect(() => {
    apiFetch<{ total_organizations: number }>("/admin/stats")
      .then(() => setChecking(false))
      .catch((e) => {
        if (e?.status === 401) { router.push("/login"); return; }
        setDenied(true);
        setChecking(false);
      });
  }, [router]);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <span className="text-sm text-muted">Vérification des droits…</span>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg">
        <div className="text-4xl">🔒</div>
        <p className="text-lg font-semibold text-text">Accès refusé</p>
        <p className="text-sm text-muted">Cette zone est réservée aux administrateurs de la plateforme.</p>
        <Link href="/dashboard" className="text-sm text-accent underline">← Retour au dashboard</Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-bg px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
