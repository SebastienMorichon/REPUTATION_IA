"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Sidebar } from "@/components/Sidebar";
import { TrialBanner } from "@/components/TrialBanner";
import { apiFetch, type BillingSubscription } from "@/lib/api";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);

  useEffect(() => {
    apiFetch<BillingSubscription>("/billing/subscription")
      .then(setSubscription)
      .catch(() => {}); // silent fail — user may not be authenticated yet
  }, []);

  return (
    <AuthGate>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          {subscription?.is_trial && subscription.trial_days_remaining !== null && (
            <TrialBanner daysRemaining={subscription.trial_days_remaining} />
          )}
          <main className="flex-1 overflow-y-auto bg-bg px-8 py-8">
            {children}
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
