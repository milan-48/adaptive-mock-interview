"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/admin/admin-shell";
import { useAuth } from "@/context/auth-context";
import { isStaffRole } from "@/lib/auth";

export default function AdminLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?tab=admin");
      return;
    }
    if (!isStaffRole(user.role)) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading || !user || !isStaffRole(user.role)) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return <AdminShell>{children}</AdminShell>;
}
