"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import CandidateShell from "@/components/candidate/candidate-shell";
import { useAuth } from "@/context/auth-context";

export default function DashboardLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?tab=candidate");
      return;
    }
    if (user.role !== "candidate") {
      router.replace("/admin");
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== "candidate") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-slate-600">
        Loading…
      </div>
    );
  }

  return <CandidateShell>{children}</CandidateShell>;
}
