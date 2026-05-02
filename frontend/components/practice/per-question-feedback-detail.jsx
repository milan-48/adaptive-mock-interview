/** Rich per-question AI feedback (substance score, signals, bullets). */
export default function PerQuestionFeedbackDetail({ feedback, dense = false }) {
  if (!feedback) return null;
  const text = dense ? "text-xs" : "text-sm";
  const label = dense ? "text-xs" : "text-sm";

  return (
    <div
      className={`space-y-2 rounded border border-emerald-100 bg-white p-3 text-slate-700 ${text}`}
    >
      <p className="text-xs font-semibold uppercase text-emerald-800">Feedback</p>
      {feedback.substanceScoreOutOf100 != null ? (
        <p className="text-slate-600">
          <span className="font-medium text-slate-800">Substance detected: </span>
          {Number(feedback.substanceScoreOutOf100)}/100 — what the model could ground in your
          answer vs. the prompt.
        </p>
      ) : null}
      {feedback.signalsDetected?.length ? (
        <div>
          <p className={`font-medium text-slate-900 ${label}`}>What showed up in your answer</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {feedback.signalsDetected.map((s, j) => (
              <li key={`sig-${j}`}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {feedback.missingOrUnclear?.length ? (
        <div>
          <p className={`font-medium text-amber-900 ${label}`}>Gaps or unclear areas</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-950/90">
            {feedback.missingOrUnclear.map((s, j) => (
              <li key={`gap-${j}`}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p>{feedback.summary}</p>
      {feedback.strengths?.length ? (
        <div>
          <p className={`font-medium text-slate-900 ${label}`}>Strengths</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {feedback.strengths.map((s, j) => (
              <li key={`st-${j}`}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {feedback.improvements?.length ? (
        <div>
          <p className={`font-medium text-slate-900 ${label}`}>Improve</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {feedback.improvements.map((s, j) => (
              <li key={`im-${j}`}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {feedback.followUpSuggestions?.length ? (
        <div>
          <p className={`font-medium text-slate-900 ${label}`}>Follow-up ideas</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {feedback.followUpSuggestions.map((s, j) => (
              <li key={`fu-${j}`}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
