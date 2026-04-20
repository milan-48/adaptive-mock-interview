"use client";

import { ShieldUser, Users } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { isStaffRole } from "@/lib/auth";
import AppShell from "@/components/layout/app-shell";

const ADMIN_NAV = [
  { href: "/admin", label: "Candidates", icon: Users },
  {
    href: "/admin/users",
    label: "Users",
    icon: ShieldUser,
    iconClass: "h-[20px] w-[20px]",
  },
];

export default function AdminShell({ children }) {
  const { user } = useAuth();

  if (!user || !isStaffRole(user.role)) return children;

  const roleLabel =
    user.role === "admin"
      ? "Super Admin"
      : user.role === "staff"
        ? "Admin Staff"
        : user.role;

  return (
    <AppShell
      navItems={ADMIN_NAV}
      collapseStorageKey="admin_sidebar_collapsed"
      logoutHref="/login?tab=admin"
      roleLabel={roleLabel}
    >
      {children}
    </AppShell>
  );
}
