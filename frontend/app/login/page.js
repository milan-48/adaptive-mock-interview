"use client";

import Image from "next/image";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageCircle,
  UserRound,
  Zap,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/context/auth-context";

const PRIMARY = "#0061FF";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=80";

function isStaffRole(role) {
  return role === "admin" || role === "staff";
}

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, logout } = useAuth();

  const mode = searchParams.get("tab") === "admin" ? "admin" : "candidate";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function goCandidate() {
    setError("");
    router.replace("/login", { scroll: false });
  }

  function goAdmin() {
    setError("");
    router.replace("/login?tab=admin", { scroll: false });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const u = await login(email, password);
      if (mode === "candidate") {
        if (u.role === "candidate") {
          router.push("/dashboard");
          return;
        }
        logout();
        setError(
          "This account is for administrators. Use the Administrator tab.",
        );
        return;
      }
      if (mode === "admin") {
        if (isStaffRole(u.role)) {
          router.push("/admin");
          return;
        }
        logout();
        setError("This account is for candidates. Use the Candidate tab.");
        return;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === "candidate" ? "Candidate Login" : "Administrator Login";
  const subtitle =
    mode === "candidate"
      ? "Sign in to practice interviews and access your candidate dashboard."
      : "Sign in with your administrator credentials to access the admin dashboard.";

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900 lg:flex-row">
      <section className="flex w-full flex-col px-6 py-8 sm:px-10 lg:w-1/2 lg:px-14 lg:py-10">
        <header className="flex shrink-0 items-center gap-2">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            <div className="relative">
              <UserRound className="h-6 w-6" strokeWidth={2} />
              <MessageCircle
                className="absolute -bottom-1 -right-1 h-3.5 w-3.5 fill-white text-white"
                strokeWidth={2}
              />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight">InterviewBrain</span>
        </header>

        <div className="flex flex-1 flex-col justify-center py-12">
          <div className="mx-auto w-full max-w-md">
            <div
              className="mb-8 flex rounded-xl border border-zinc-200 bg-zinc-50 p-1"
              role="tablist"
              aria-label="Login type"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "candidate"}
                onClick={goCandidate}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                  mode === "candidate"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Candidate
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "admin"}
                onClick={goAdmin}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                  mode === "admin"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Administrator
              </button>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              {subtitle}
            </p>

            <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
              <div>
                <label
                  htmlFor="login-email"
                  className="text-sm font-medium text-zinc-800"
                >
                  Email<span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400"
                    aria-hidden
                  />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-11 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#0061FF] focus:ring-2 focus:ring-[#0061FF]/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="text-sm font-medium text-zinc-800"
                >
                  Password<span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400"
                    aria-hidden
                  />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-11 pr-12 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#0061FF] focus:ring-2 focus:ring-[#0061FF]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-[18px] w-[18px]" />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" />
                    )}
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <a
                    href="#"
                    className="text-sm font-medium hover:underline"
                    style={{ color: PRIMARY }}
                  >
                    Forgot Password?
                  </a>
                </div>
              </div>

              {error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: PRIMARY }}
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>

        <footer className="shrink-0 text-center text-xs text-zinc-400 lg:text-left">
          All Rights Reserved |{" "}
          <a href="#" className="underline" style={{ color: PRIMARY }}>
            Terms and Conditions
          </a>{" "}
          |{" "}
          <a href="#" className="underline" style={{ color: PRIMARY }}>
            Privacy Policy
          </a>
        </footer>
      </section>

      <section
        className="relative hidden min-h-[320px] w-full overflow-hidden lg:flex lg:min-h-screen lg:w-1/2"
        style={{ backgroundColor: PRIMARY }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          aria-hidden
        >
          <svg
            className="absolute -left-20 top-10 h-80 w-80 text-white"
            viewBox="0 0 200 200"
          >
            <path
              fill="currentColor"
              d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.6,90.1,-16.3,88.1,-1.2C86.1,13.9,79.4,27.8,70.1,39.8C60.8,51.8,48.9,61.9,35.8,67.8C22.7,73.7,8.5,75.4,-5.4,84.1C-19.3,92.8,-32.9,108.5,-45.6,106.8C-58.3,105.1,-70.1,86,-76.8,69.8C-83.5,53.6,-85.1,40.3,-83.4,27.8C-81.7,15.3,-76.7,3.6,-71.3,-7.2C-65.9,-18,-60.1,-27.9,-52.4,-36.8C-44.7,-45.7,-35.1,-53.6,-24.5,-62.8C-13.9,-72,-2.3,-82.4,9.7,-83.6C21.7,-84.8,40.5,-76.8,44.7,-76.4Z"
              transform="translate(100 100)"
            />
          </svg>
          <svg
            className="absolute bottom-0 right-0 h-96 w-96 text-white"
            viewBox="0 0 200 200"
          >
            <path
              fill="currentColor"
              d="M39.5,-65.4C53.7,-60.1,69.7,-55.7,77.8,-44.1C85.9,-32.5,86.1,-13.7,83.4,3.8C80.7,21.3,75.1,37.5,65.8,50.8C56.5,64.1,43.5,74.5,29.1,79.8C14.7,85.1,-1.1,85.3,-16.4,81.6C-31.7,77.9,-46.5,70.3,-58.8,59.8C-71.1,49.3,-80.9,35.9,-84.8,21.1C-88.7,6.3,-86.7,-9.9,-79.8,-23.8C-72.9,-37.7,-61.1,-48.3,-48.3,-54.1C-35.5,-59.9,-21.7,-60.9,-8.5,-63.6C4.7,-66.3,25.3,-70.7,39.5,-65.4Z"
              transform="translate(100 100)"
            />
          </svg>
        </div>

        <div className="relative z-10 flex w-full flex-col items-center justify-center p-10 lg:p-14">
          <div className="relative w-full max-w-lg">
            <div className="rounded-3xl border border-white/35 bg-white/15 p-8 shadow-2xl backdrop-blur-xl lg:p-10">
              <h2 className="text-2xl font-bold leading-snug text-white lg:text-[1.65rem]">
                Welcome back to InterviewBrain
              </h2>
              <div className="relative mt-8 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white/10 shadow-inner">
                <Image
                  src={HERO_IMAGE}
                  alt="Professional using a tablet"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 0px, 50vw"
                  priority
                />
              </div>
            </div>

            <div
              className="absolute -bottom-3 left-6 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg lg:left-8"
              style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }}
            >
              <Zap
                className="h-7 w-7 text-amber-400"
                fill="currentColor"
                strokeWidth={1.5}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-zinc-500">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
