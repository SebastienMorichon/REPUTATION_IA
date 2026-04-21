"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken, getUser, setUser, clearToken, clearUser, type User } from "@/lib/api";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    const storedUser = getUser();

    // If is_admin is already stored, no need for an extra round-trip
    if (storedUser && typeof storedUser.is_admin !== "undefined") {
      setReady(true);
      return;
    }

    // User was logged in before is_admin was added to the schema — refresh from /auth/me
    apiFetch<User>("/auth/me")
      .then((freshUser) => {
        setUser(freshUser);
        setReady(true);
      })
      .catch(() => {
        // Token expired or invalid
        clearToken();
        clearUser();
        router.replace("/login");
      });
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
