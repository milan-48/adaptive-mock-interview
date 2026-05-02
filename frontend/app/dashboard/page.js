"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import Button from "@/components/ui/button";
import PerQuestionFeedbackDetail from "@/components/practice/per-question-feedback-detail";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";

const TYPE_OPTIONS = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "system_design", label: "System design" },
];

export default function PracticeDashboardPage() {
  const { user } = useAuth();
  const [interviewType, setInterviewType] = useState("technical");
  const [yearsExperience, setYearsExperience] = useState("3");
  const [resumeText, setResumeText] = useState("");
  const [questions, setQuestions] = useState([]);
  const [perQuestion, setPerQuestion] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [sessionResult, setSessionResult] = useState(null);
  const [savedSessionId, setSavedSessionId] = useState(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [error, setError] = useState("");

  const currentQuestion = questions[currentIndex] || null;
  const isLastQuestion = questions.length > 0 && currentIndex === questions.length - 1;

  const allAnswersReady = useMemo(() => {
    if (questions.length === 0 || perQuestion.length !== questions.length) return false;
    return perQuestion.every((p) => (p?.answer || "").trim().length > 0);
  }, [questions.length, perQuestion]);

  const aiDetectedPercent = useMemo(() => {
    const scores = perQuestion
      .map((p) => Number(p?.feedback?.substanceScoreOutOf100))
      .filter((n) => Number.isFinite(n));
    if (!scores.length) return null;
    return Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length);
  }, [perQuestion]);

  function getMissingQuestionNumbers(rows) {
    return questions
      .map((_, i) => i)
      .filter((i) => !((rows?.[i]?.answer || "").trim().length > 0))
      .map((i) => i + 1);
  }

  const passStatus = useMemo(() => {
    if (!sessionResult) return null;
    const ai = Number(aiDetectedPercent);
    const score = Number(sessionResult?.scoreOutOf100 || 0);
    if (Number.isFinite(ai) && ai > 50) return "Failed";
    return score > 75 ? "Passed" : "Failed";
  }, [sessionResult, aiDetectedPercent]);

  const failReasons = useMemo(() => {
    if (!sessionResult) return [];
    const reasons = [];
    if (aiDetectedPercent != null && aiDetectedPercent > 50) {
      reasons.push(`AI detected in answers is ${aiDetectedPercent}% (must be 50% or below).`);
    }
    const score = Number(sessionResult?.scoreOutOf100 || 0);
    if (score <= 75) {
      reasons.push(`Session score is ${score}/100 (must be above 75).`);
    }
    return reasons;
  }, [sessionResult, aiDetectedPercent]);

  const hasOngoingPractice = useMemo(
    () => questions.length > 0 && !sessionResult,
    [questions.length, sessionResult],
  );

  useEffect(() => {
    if (!perQuestion.length) return;
    const row = perQuestion[currentIndex];
    if (!row) return;
    setAnswer(row.answer ?? "");
    setFeedback(row.feedback ?? null);
  }, [currentIndex, perQuestion]);

  useEffect(() => {
    if (!hasOngoingPractice) return undefined;

    const warningText =
      "If you leave now, this practice session will not be recorded. Are you sure?";

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = warningText;
      return warningText;
    };

    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#")) return;
      if (href.startsWith("javascript:")) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("target") === "_blank") return;

      const nextUrl = new URL(anchor.href, window.location.origin);
      const currentUrl = new URL(window.location.href);
      const samePathAndQuery =
        nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search;
      if (samePathAndQuery) return;

      const ok = window.confirm(warningText);
      if (!ok) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasOngoingPractice]);

  async function runCompleteSession(perQuestionRows) {
    const rows = perQuestionRows ?? perQuestion;
    if (!questions.length) return;
    if (!rows.length || rows.length !== questions.length) return;
    const missingNumbers = getMissingQuestionNumbers(rows);
    if (missingNumbers.length > 0) {
      setError(
        `Please add a real answer (not spaces) for question${missingNumbers.length > 1 ? "s" : ""} ${missingNumbers.join(", ")} before generating overall result.`,
      );
      return;
    }
    setError("");
    setLoadingSummary(true);
    try {
      const turns = questions.map((q, i) => ({
        question: q.text,
        answer: (rows[i]?.answer || "").trim(),
        perQuestionFeedback: rows[i]?.feedback ?? null,
      }));
      const data = await apiFetch("/v1/practice/session-summary", {
        method: "POST",
        body: JSON.stringify({
          interviewType,
          yearsExperience: Number(yearsExperience),
          resumeText: resumeText.trim() || undefined,
          turns,
        }),
      });
      const { sessionId, turns: returnedTurns, ...resultPayload } = data;
      if (Array.isArray(returnedTurns) && returnedTurns.length === questions.length) {
        setPerQuestion(
          questions.map((_, i) => ({
            answer: returnedTurns[i].answer,
            feedback: returnedTurns[i].perQuestionFeedback,
          })),
        );
      }
      setSessionResult(resultPayload);
      setSavedSessionId(sessionId || null);
    } catch (e) {
      setError(e.message || "Could not generate overall result");
      setSessionResult(null);
      setSavedSessionId(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleGenerate() {
    setError("");
    setFeedback(null);
    setAnswer("");
    setSessionResult(null);
    setSavedSessionId(null);
    setLoadingQuestions(true);
    try {
      const data = await apiFetch("/v1/practice/generate-questions", {
        method: "POST",
        body: JSON.stringify({
          interviewType,
          yearsExperience: Number(yearsExperience),
          resumeText: resumeText.trim() || undefined,
        }),
      });
      const qs = data.questions || [];
      setQuestions(qs);
      setPerQuestion(qs.map(() => ({ answer: "", feedback: null })));
      setCurrentIndex(0);
    } catch (e) {
      setError(e.message || "Could not generate questions");
      setQuestions([]);
      setPerQuestion([]);
    } finally {
      setLoadingQuestions(false);
    }
  }

  function patchCurrentAnswer(value) {
    setAnswer(value);
    setPerQuestion((prev) => {
      const next = [...prev];
      if (!next[currentIndex]) return prev;
      next[currentIndex] = { ...next[currentIndex], answer: value };
      return next;
    });
  }

  async function handleGetFeedback() {
    if (!currentQuestion) return;
    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      setError(
        `Please add a real answer (not spaces) for question ${currentIndex + 1} before getting feedback.`,
      );
      return;
    }
    setError("");
    setLoadingFeedback(true);
    try {
      const data = await apiFetch("/v1/practice/feedback", {
        method: "POST",
        body: JSON.stringify({
          interviewType,
          yearsExperience: Number(yearsExperience),
          resumeText: resumeText.trim() || undefined,
          question: currentQuestion.text,
          answer: trimmedAnswer,
        }),
      });
      setFeedback(data);
      setPerQuestion((prev) => {
        const next = [...prev];
        next[currentIndex] = {
          answer: trimmedAnswer,
          feedback: data,
        };
        const onLast = currentIndex === questions.length - 1;
        const everyHasFeedback = next.every((p) => p?.feedback);
        if (onLast && everyHasFeedback) {
          queueMicrotask(() => {
            void runCompleteSession(next);
          });
        }
        return next;
      });
    } catch (e) {
      setError(e.message || "Could not get feedback");
      setFeedback(null);
    } finally {
      setLoadingFeedback(false);
    }
  }

  function handleNext() {
    setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
  }

  function handlePrev() {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }

  function handleRestart() {
    setQuestions([]);
    setPerQuestion([]);
    setCurrentIndex(0);
    setAnswer("");
    setFeedback(null);
    setSessionResult(null);
    setSavedSessionId(null);
    setError("");
  }

  function handleRequestRestart() {
    const hasWork =
      questions.length > 0 &&
      (perQuestion.some((p) => (p?.answer || "").trim() || p?.feedback) || sessionResult);
    if (!hasWork) {
      handleRestart();
      return;
    }
    setShowDiscardModal(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-3 sm:pt-4">
      {loadingSummary ? (
        <div className="sticky top-2 z-20 rounded-xl border border-blue-200 bg-blue-50/95 p-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <div>
              <p className="text-sm font-semibold text-blue-900">Generating session result…</p>
              <p className="text-xs text-blue-800/90">
                Creating missing question feedback (if any), then computing final score and
                readiness.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <Card>
        <CardHeader
          title="AI interview practice"
          subtitle={
            user?.email
              ? `Text practice — per-question coaching, then session readiness & role fit. (${user.email})`
              : "Text practice — per-question coaching, then session readiness & role fit."
          }
        />
      </Card>

      {questions.length === 0 ? (
        <Card>
          <div className="space-y-4 p-4">
            <div>
              <label className="label">Interview type</label>
              <select
                className="input select-input"
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value)}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Years of experience in this area</label>
              <input
                type="number"
                min={0}
                max={60}
                step={0.5}
                className="input"
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Resume or background (optional)</label>
              <textarea
                className="input min-h-[120px]"
                placeholder="Paste a short summary or resume excerpt…"
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={loadingQuestions}
              className="w-full sm:w-auto"
            >
              {loadingQuestions ? "Generating…" : "Generate 5 questions"}
            </Button>
          </div>
        </Card>
      ) : sessionResult ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">Session complete</p>
            <Button type="button" variant="secondary" onClick={handleRequestRestart}>
              New set
            </Button>
          </div>

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
                  Session score: {sessionResult.scoreOutOf100} / 100
                  {sessionResult.interviewReadinessScore != null ? (
                    <span className="block sm:inline sm:before:content-['_·_']">
                      Interview readiness: {sessionResult.interviewReadinessScore} / 100
                    </span>
                  ) : null}
                  {aiDetectedPercent != null ? (
                    <span className="block sm:inline sm:before:content-['_·_']">
                      AI detected in answers: {aiDetectedPercent}%
                    </span>
                  ) : null}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-slate-800">
                {sessionResult.overallSummary}
              </p>
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
              {sessionResult.interviewReadinessSummary ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-600">
                    Readiness detail
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {sessionResult.interviewReadinessSummary}
                  </p>
                </div>
              ) : null}
              {sessionResult.roleFitSummary ? (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                  <p className="text-xs font-semibold uppercase text-indigo-800">Role fit</p>
                  <p className="mt-1 text-sm text-slate-800">{sessionResult.roleFitSummary}</p>
                  {sessionResult.suitableRoles?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
                      {sessionResult.suitableRoles.map((s, i) => (
                        <li key={`role-${i}`}>{s}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {sessionResult.topStrengths?.length ? (
                <div>
                  <p className="text-sm font-semibold text-slate-900">Top strengths</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {sessionResult.topStrengths.map((s, i) => (
                      <li key={`ts-${i}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {sessionResult.priorityImprovements?.length ? (
                <div>
                  <p className="text-sm font-semibold text-slate-900">Priority improvements</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {sessionResult.priorityImprovements.map((s, i) => (
                      <li key={`pi-${i}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {sessionResult.nextPracticeFocus?.length ? (
                <div>
                  <p className="text-sm font-semibold text-slate-900">Next practice focus</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {sessionResult.nextPracticeFocus.map((s, i) => (
                      <li key={`np-${i}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {savedSessionId ? (
                <p className="border-t border-slate-100 pt-4 text-sm text-slate-600">
                  Saved to your history.{" "}
                  <Link
                    href={`/dashboard/practice-history/${savedSessionId}`}
                    className="font-medium text-[#0f2942] underline decoration-slate-300 underline-offset-2 hover:decoration-[#0f2942]"
                  >
                    View this session
                  </Link>
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <h2 className="text-base font-semibold text-slate-900">
                Your answers &amp; per-question feedback
              </h2>
              <ul className="mt-4 space-y-4 text-sm">
                {questions.map((q, i) => (
                  <li
                    key={q.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                  >
                    <p className="font-medium text-slate-900">
                      {i + 1}. {q.text}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-slate-700">
                      <span className="font-medium text-slate-600">Answer: </span>
                      {perQuestion[i]?.answer || "—"}
                    </p>
                    <div className="mt-2">
                      <PerQuestionFeedbackDetail feedback={perQuestion[i]?.feedback} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">
                  Question {currentIndex + 1} of {questions.length}
                  {isLastQuestion ? (
                    <span className="ml-2 text-slate-500">(last question)</span>
                  ) : null}
                  {perQuestion[currentIndex]?.feedback ? (
                    <span className="ml-2 text-emerald-600">· Feedback saved</span>
                  ) : null}
                </p>
                <Button type="button" variant="secondary" onClick={handleRequestRestart}>
                  New set
                </Button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-900">
                <p className="text-sm font-semibold text-slate-500">Question</p>
                <p className="mt-1 text-base leading-relaxed">{currentQuestion?.text}</p>
              </div>
              <div>
                <label className="label">Your answer</label>
                <textarea
                  className="input min-h-[160px]"
                  placeholder="Type your answer here…"
                  value={answer}
                  onChange={(e) => patchCurrentAnswer(e.target.value)}
                  disabled={loadingSummary}
                />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleGetFeedback}
                  disabled={loadingFeedback || loadingSummary || !answer.trim()}
                >
                  {loadingFeedback ? "Getting feedback…" : "Get feedback for this question"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handlePrev}
                  disabled={currentIndex === 0 || loadingSummary}
                >
                  Previous
                </Button>
                {currentIndex < questions.length - 1 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleNext}
                    disabled={loadingSummary}
                  >
                    Next question
                  </Button>
                ) : null}
              </div>

              {feedback ? (
                <PerQuestionFeedbackDetail feedback={feedback} />
              ) : null}

              <div className="border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  onClick={() => void runCompleteSession()}
                  disabled={!allAnswersReady || loadingSummary}
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  {loadingSummary
                    ? "Generating session result…"
                    : "Get overall result & readiness"}
                </Button>
                <p className="mt-2 text-xs text-slate-500">
                  You need a written answer for each question. Any question without feedback yet
                  will get AI feedback first, then you&apos;ll see the full session score,
                  readiness, and role suggestions.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      {showDiscardModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Discard current practice?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Starting a new set will discard this in-progress session. To keep it, finish and get
              the overall result first.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDiscardModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowDiscardModal(false);
                  handleRestart();
                }}
              >
                Discard and start new
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
