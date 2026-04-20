"use client";

import { CalendarDays } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import AppShell from "@/components/layout/app-shell";

const CANDIDATE_NAV = [
  { href: "/dashboard", label: "Interviews", icon: CalendarDays },
];

export default function CandidateShell({ children }) {
  const { user } = useAuth();

  if (!user || user.role !== "candidate") return children;

  return (
    <AppShell
      navItems={CANDIDATE_NAV}
      collapseStorageKey="candidate_sidebar_collapsed"
      logoutHref="/login?tab=candidate"
      roleLabel="Candidate"
    >
      {children}
    </AppShell>
  );
}
