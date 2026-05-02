"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import PerQuestionFeedbackDetail from "@/components/practice/per-question-feedback-detail";
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

export default function PracticeSessionDetailPage() {
  const params = useParams();
  const sessionId = params?.sessionId;
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      setError("");
      setLoading(true);
      try {
        const data = await apiFetch(`/v1/practice/sessions/${sessionId}`);
        if (!cancelled) setSession(data);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Could not load session");
          setSession(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const result = session?.result;
  const aiDetectedPercent = (session?.turns || [])
    .map((t) => Number(t?.perQuestionFeedback?.substanceScoreOutOf100))
    .filter((n) => Number.isFinite(n));
  const avgAiDetectedPercent = aiDetectedPercent.length
    ? Math.round(aiDetectedPercent.reduce((sum, n) => sum + n, 0) / aiDetectedPercent.length)
    : null;
  const passStatus = result
    ? avgAiDetectedPercent != null && avgAiDetectedPercent > 50
      ? "Failed"
      : Number(result.scoreOutOf100 || 0) > 75
        ? "Passed"
        : "Failed"
    : null;
  const failReasons = result
    ? [
        ...(avgAiDetectedPercent != null && avgAiDetectedPercent > 50
          ? [
              `AI detected in answers is ${avgAiDetectedPercent}% (must be 50% or below).`,
            ]
          : []),
        ...(Number(result.scoreOutOf100 || 0) <= 75
          ? [
              `Session score is ${Number(result.scoreOutOf100 || 0)}/100 (must be above 75).`,
            ]
          : []),
      ]
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-3 sm:pt-4">
      <p>
        <Link
          href="/dashboard/practice-history"
          className="text-sm font-medium text-[#0f2942] underline decoration-slate-300 underline-offset-2 hover:decoration-[#0f2942]"
        >
          ← Back to history
        </Link>
      </p>

      {loading ? (
        <Card>
          <p className="p-4 text-sm text-slate-600">Loading…</p>
        </Card>
      ) : error ? (
        <Card>
          <p className="p-4 text-sm text-red-600">{error}</p>
        </Card>
      ) : !session ? null : (
        <>
          <Card>
            <CardHeader
              title={interviewTypeLabel(session.interviewType)}
              subtitle={`${formatWhen(session.createdAt)} · ${session.yearsExperience} yrs experience · ${session.turns?.length ?? 0} questions`}
            />
          </Card>

          {result ? (
            <Card>
              <div className="space-y-4 p-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Overall result</h2>
                  {passStatus ? (
                    <p
                      className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        passStatus === "Passed"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {passStatus}
                    </p>
                  ) : null}
                  <p className="text-sm text-slate-600">
                    Session score: {result.scoreOutOf100} / 100
                    {result.interviewReadinessScore != null ? (
                      <span className="block sm:inline sm:before:content-['_·_']">
                        Interview readiness: {result.interviewReadinessScore} / 100
                      </span>
                    ) : null}
                    {avgAiDetectedPercent != null ? (
                      <span className="block sm:inline sm:before:content-['_·_']">
                        AI detected in answers: {avgAiDetectedPercent}%
                      </span>
                    ) : null}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-slate-800">{result.overallSummary}</p>
                <p className="text-xs text-slate-500">
                  Rule: Failed if AI detected is over 50%. Otherwise Passed requires score above
                  75%.
                </p>
                {passStatus === "Failed" ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-xs font-semibold uppercase text-red-800">Failure reason</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-red-900">
                      {failReasons.map((r, i) => (
                        <li key={`fail-${i}`}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {result.interviewReadinessSummary ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-600">
                      Readiness detail
                    </p>
                    <p className="mt-1 text-sm text-slate-800">{result.interviewReadinessSummary}</p>
                  </div>
                ) : null}
                {result.roleFitSummary ? (
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                    <p className="text-xs font-semibold uppercase text-indigo-800">Role fit</p>
                    <p className="mt-1 text-sm text-slate-800">{result.roleFitSummary}</p>
                    {result.suitableRoles?.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
                        {result.suitableRoles.map((s, i) => (
                          <li key={`role-${i}`}>{s}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                {result.topStrengths?.length ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Top strengths</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {result.topStrengths.map((s, i) => (
                        <li key={`ts-${i}`}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {result.priorityImprovements?.length ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Priority improvements</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {result.priorityImprovements.map((s, i) => (
                        <li key={`pi-${i}`}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {result.nextPracticeFocus?.length ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Next practice focus</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {result.nextPracticeFocus.map((s, i) => (
                        <li key={`np-${i}`}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="p-4">
              <h2 className="text-base font-semibold text-slate-900">Questions &amp; answers</h2>
              <ul className="mt-4 space-y-4 text-sm">
                {(session.turns || []).map((t, i) => (
                  <li
                    key={`${i}-${t.question?.slice(0, 24)}`}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                  >
                    <p className="font-medium text-slate-900">
                      {i + 1}. {t.question}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-slate-700">
                      <span className="font-medium text-slate-600">Answer: </span>
                      {t.answer || "—"}
                    </p>
                    <div className="mt-3">
                      <PerQuestionFeedbackDetail feedback={t.perQuestionFeedback} dense />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
