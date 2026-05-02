"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { interviewTypeLabel } from "@/lib/practiceLabels";

function formatWhen(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

export default function PracticeHistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      setLoading(true);
      try {
        const data = await apiFetch("/v1/practice/sessions");
        if (!cancelled) setSessions(data.sessions || []);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Could not load history");
          setSessions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-3 sm:pt-4">
      <Card>
        <CardHeader
          title="Practice history"
          subtitle="Completed sessions with overall scores and saved Q&amp;A."
        />
      </Card>

      {loading ? (
        <Card>
          <p className="p-4 text-sm text-slate-600">Loading…</p>
        </Card>
      ) : error ? (
        <Card>
          <p className="p-4 text-sm text-red-600">{error}</p>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <div className="space-y-3 p-4 text-sm text-slate-700">
            <p>No completed sessions yet.</p>
            <p className="text-slate-600">
              On the Practice tab, finish all five questions, get feedback on each, then generate an
              overall result. It will appear here automatically.
            </p>
            <Link
              href="/dashboard"
              className="inline-block font-medium text-[#0f2942] underline decoration-slate-300 underline-offset-2 hover:decoration-[#0f2942]"
            >
              Go to Practice
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/dashboard/practice-history/${s.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-4 transition-colors hover:bg-slate-50/80"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {interviewTypeLabel(s.interviewType)}
                      <span className="font-normal text-slate-500">
                        {" "}
                        · {s.questionCount} questions
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatWhen(s.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold tabular-nums text-[#0f2942]">
                      {s.scoreOutOf100} / 100
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        s.passStatus === "Passed"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {s.passStatus || "Failed"}
                    </span>
                    {(s.passStatus || "Failed") === "Failed" ? (
                      <span
                        title={
                          s.failReasons?.length
                            ? s.failReasons.join(" ")
                            : "Failed due to score/AI-detected rule."
                        }
                        className="inline-flex text-red-700"
                        aria-label="Failure reason"
                      >
                        <CircleAlert className="h-4 w-4" strokeWidth={2} />
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
