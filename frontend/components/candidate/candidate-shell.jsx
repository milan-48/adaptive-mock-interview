"use client";

import { CalendarDays, History } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import AppShell from "@/components/layout/app-shell";

const CANDIDATE_NAV = [
  { href: "/dashboard", label: "Practice", icon: CalendarDays },
  { href: "/dashboard/practice-history", label: "History", icon: History },
];

export default function CandidateShell({ children }) {
  const { user, isImpersonating, switchBackToAdmin } = useAuth();

  if (!user || user.role !== "candidate") return children;

  async function handleSwitchToSuperAdmin() {
    try {
      await switchBackToAdmin();
      window.location.assign("/admin");
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "Could not switch back to super admin");
    }
  }

  return (
    <AppShell
      navItems={CANDIDATE_NAV}
      collapseStorageKey="candidate_sidebar_collapsed"
      logoutHref="/login?tab=candidate"
      roleLabel="Candidate"
      impersonation={
        isImpersonating
          ? {
              active: true,
              candidateLabel: user.name || user.email || "Candidate",
              candidateAvatarUrl: user.avatarUrl || "",
              onSwitchToSuperAdmin: handleSwitchToSuperAdmin,
            }
          : null
      }
    >
      {children}
    </AppShell>
  );
}
