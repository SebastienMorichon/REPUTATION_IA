"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/api";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/brands", label: "Brands" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/dashboard" className="text-lg font-semibold text-text">
          <span className="text-accent">AI</span> Reputation Shield
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname === l.href || pathname?.startsWith(l.href + "/")
                  ? "text-text"
                  : "text-muted hover:text-text"
              }
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={() => {
              clearToken();
              router.push("/login");
            }}
            className="text-muted hover:text-text"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
