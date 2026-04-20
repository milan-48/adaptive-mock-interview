"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  UserRound,
  ShieldUser,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { isStaffRole } from "@/lib/auth";
import Avatar from "@/components/admin/avatar";

const STORAGE_KEY = "admin_sidebar_collapsed";

const navItems = [
  { href: "/admin", label: "Candidates", icon: Users },
  { href: "/admin/users", label: "Users", icon: ShieldUser, iconClass: "h-[20px] w-[20px]" },
];

const EXPANDED_W = 260;
const COLLAPSED_W = 72;

export default function AdminShell({ children }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (!user || !isStaffRole(user.role)) return children;

  const sidebarW = collapsed ? COLLAPSED_W : EXPANDED_W;

  const roleLabel =
    user.role === "admin"
      ? "Super Admin"
      : user.role === "staff"
        ? "Admin Staff"
        : user.role;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1f2937] antialiased">
      {/* Mobile header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 shadow-sm lg:hidden">
        <span className="text-[17px] font-bold tracking-tight text-[#111827]">
          InterviewBrain
        </span>
        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/35 lg:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full flex-col border-r border-slate-200 bg-white shadow-[2px_0_12px_rgba(15,23,42,0.04)] transition-[width,transform] duration-200 ease-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ width: sidebarW }}
      >
        <div
          className={`relative flex shrink-0 items-center border-b border-slate-100 py-4 ${
            collapsed ? "justify-center px-2" : "gap-3 px-4"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1d61ff] to-[#38bdf8] text-white shadow-sm">
            <UserRound className="h-5 w-5" strokeWidth={2} />
          </div>
          {!collapsed ? (
            <span className="min-w-0 flex-1 truncate pr-1 text-[17px] font-bold tracking-tight text-[#111827]">
              InterviewBrain
            </span>
          ) : null}
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
          {/* Desktop: collapse toggle on sidebar edge, vertically centered with logo row */}
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute right-0 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-[#1d61ff] shadow-sm transition hover:bg-slate-50 hover:shadow-md lg:flex"
            onClick={toggleCollapse}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center rounded-[10px] font-medium transition-colors ${
                  collapsed ? "justify-center px-0 py-3.5" : "gap-3 px-3 py-3"
                } ${
                  active
                    ? "bg-[#eaf2ff] text-[#1d4ed8] shadow-sm ring-1 ring-[#cfe0ff]"
                    : "text-[#374151] hover:bg-slate-50"
                }`}
              >
                <Icon
                  className={`${item.iconClass || "h-[18px] w-[18px]"} shrink-0 ${
                    active ? "text-[#1d4ed8]" : "text-slate-600 group-hover:text-slate-900"
                  }`}
                  strokeWidth={2}
                />
                {!collapsed ? (
                  <span className="text-[15px] leading-snug tracking-tight">
                    {item.label}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className={`shrink-0 border-t border-slate-100 p-3 ${collapsed ? "px-2" : ""}`}>
          <div
            className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${
              collapsed ? "flex flex-col items-center gap-2" : ""
            }`}
          >
            <div className={`flex items-center gap-3 ${collapsed ? "flex-col" : ""}`}>
              <Avatar user={user} />
              {!collapsed ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold leading-snug text-[#111827]">
                    {user.name || user.email?.split("@")[0] || "User"}
                  </p>
                  <p className="truncate text-[13px] font-medium text-slate-500">
                    {roleLabel}
                  </p>
                </div>
              ) : null}
            </div>
            {!collapsed ? (
              <button
                type="button"
                className="mt-3 w-full rounded-lg border border-slate-200 bg-white py-2.5 text-[14px] font-semibold text-[#374151] transition hover:bg-slate-50"
                onClick={() => {
                  logout();
                  router.push("/login?tab=admin");
                }}
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                title="Sign out"
                className="mt-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => {
                  logout();
                  router.push("/login?tab=admin");
                }}
              >
                <LogOut className="h-5 w-5" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main
        className={`min-h-screen px-4 py-6 transition-[margin] duration-200 ease-out sm:px-6 lg:px-8 ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
