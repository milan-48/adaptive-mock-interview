"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import Avatar from "@/components/admin/avatar";

const EXPANDED_W = 260;
const COLLAPSED_W = 72;

function ImpersonationChipFace({ avatarUrl, size, label }) {
  const url = String(avatarUrl || "").trim();
  const isSm = size === "sm";
  const box = isSm ? "h-7 w-7" : "h-9 w-9";
  const imgPx = isSm ? 28 : 36;
  if (url) {
    return (
      <div
        className={`relative ${box} shrink-0 overflow-hidden rounded-md bg-slate-200 ring-1 ring-slate-200/80`}
      >
        <Image
          src={url}
          alt={label ? `Avatar — ${label}` : "Avatar"}
          width={imgPx}
          height={imgPx}
          unoptimized
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center rounded-md bg-[#0f2942] text-white`}
    >
      <UserRound className={isSm ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"} strokeWidth={2} />
    </div>
  );
}

/**
 * Shared app chrome: sidebar, collapse, profile — used by admin and candidate layouts.
 */
/**
 * @param {object} [impersonation] Super-admin viewing as another user
 * @param {boolean} impersonation.active
 * @param {string} impersonation.candidateLabel — shown top-right pill
 * @param {string} [impersonation.candidateAvatarUrl] — optional uploaded avatar
 * @param {() => void | Promise<void>} impersonation.onSwitchToSuperAdmin
 */
export default function AppShell({
  children,
  navItems,
  collapseStorageKey,
  logoutHref,
  roleLabel,
  impersonation = null,
}) {
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
        if (localStorage.getItem(collapseStorageKey) === "1") setCollapsed(true);
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [collapseStorageKey]);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(collapseStorageKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const sidebarW = collapsed ? COLLAPSED_W : EXPANDED_W;
  const imp = impersonation?.active ? impersonation : null;

  function normalizePath(p) {
    if (!p || p === "/") return "/";
    return p.replace(/\/$/, "") || "/";
  }

  /**
   * Active nav item: exact match, or prefix match for nested routes.
   * `/admin` and `/dashboard` are section roots — only exact match, not every child path
   * (e.g. `/dashboard/practice-history` must not highlight Practice).
   */
  function isNavActive(href) {
    const p = normalizePath(pathname);
    const h = normalizePath(href);
    if (p === h) return true;
    if (h === "/admin" || h === "/dashboard") return false;
    if (h !== "/" && p.startsWith(`${h}/`)) return true;
    return false;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1f2937] antialiased">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3.5 shadow-sm lg:hidden">
        <span className="text-[17px] font-bold tracking-tight text-[#111827]">
          InterviewBrain
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {imp ? (
            <div
              className="inline-flex w-fit min-w-0 max-w-[min(18rem,calc(100%-3rem))] items-center gap-2.5 rounded-xl bg-[#f2f2f2] py-1.5 pl-1.5 pr-3"
              title={imp.candidateLabel}
            >
              <ImpersonationChipFace
                avatarUrl={imp.candidateAvatarUrl}
                label={imp.candidateLabel}
                size="sm"
              />
              <span className="truncate text-[13px] font-medium text-[#3c4858]">{imp.candidateLabel}</span>
            </div>
          ) : null}
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/35 lg:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

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
            const active = isNavActive(item.href);
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
          {imp ? (
            <button
              type="button"
              title="Switch to Super Admin"
              onClick={() => void imp.onSwitchToSuperAdmin?.()}
              className={`relative z-10 mb-3 flex w-full items-center rounded-[10px] font-medium text-[#374151] transition-colors hover:bg-slate-50 ${
                collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-3"
              }`}
            >
              <ArrowLeftRight
                className="h-[18px] w-[18px] shrink-0 text-slate-600"
                strokeWidth={2}
              />
              {!collapsed ? (
                <span className="text-left text-[15px] leading-snug tracking-tight">
                  Switch Super Admin
                </span>
              ) : null}
            </button>
          ) : null}
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
                    {user?.name || user?.email?.split("@")[0] || "User"}
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
                  router.push(logoutHref);
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
                  router.push(logoutHref);
                }}
              >
                <LogOut className="h-5 w-5" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {imp ? (
        <header
          className="fixed right-0 top-0 z-30 hidden min-h-[72px] items-center justify-end border-b border-slate-100 bg-white px-4 sm:px-6 lg:flex"
          style={{ left: sidebarW }}
        >
          {/* Same vertical rhythm as sidebar logo row (py-4 + h-10 content ≈ 72px); chip centered in this strip */}
          <div
            className="inline-flex w-fit max-w-[min(28rem,calc(100%-1rem))] shrink-0 items-center gap-3 rounded-xl bg-[#f2f2f2] py-2 pl-2 pr-4"
            title={imp.candidateLabel}
          >
            <ImpersonationChipFace
              avatarUrl={imp.candidateAvatarUrl}
              label={imp.candidateLabel}
              size="lg"
            />
            <span className="truncate text-[0.9375rem] font-medium leading-tight text-[#3c4858]">
              {imp.candidateLabel}
            </span>
          </div>
        </header>
      ) : null}

      <main
        className={`min-h-screen px-4 py-6 transition-[margin] duration-200 ease-out sm:px-6 lg:px-8 ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        } ${imp ? "lg:pt-[72px]" : ""}`}
      >
        {children}
      </main>
    </div>
  );
}
