"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

const TYPE_OPTIONS = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "system_design", label: "System design" },
];

const DURATION_PRESETS = [15, 30, 45, 60];

export default function ScheduleInterviewDrawer({
  open,
  onClose,
  candidates,
  onScheduled,
}) {
  const [candidateId, setCandidateId] = useState("");
  const [interviewType, setInterviewType] = useState("technical");
  const [resumeUrl, setResumeUrl] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [durationMode, setDurationMode] = useState("preset");
  const [durationPreset, setDurationPreset] = useState(15);
  const [durationCustom, setDurationCustom] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setError("");
      setCandidateId("");
      setInterviewType("technical");
      setResumeUrl("");
      setYearsExperience("");
      setDurationMode("preset");
      setDurationPreset(15);
      setDurationCustom(15);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function onResumeFile(e) {
    const file = e.target.files?.[0];
    if (!file) {
      setResumeUrl("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setResumeUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const hasResume = Boolean(resumeUrl?.trim());
    const years = yearsExperience === "" ? null : Number(yearsExperience);
    if (!hasResume && (years === null || Number.isNaN(years) || years < 0)) {
      setError("Enter years of experience in this field, or upload a resume.");
      return;
    }
    const durationMinutes =
      durationMode === "preset" ? durationPreset : Number(durationCustom);
    if (
      Number.isNaN(durationMinutes) ||
      durationMinutes < 5 ||
      durationMinutes > 180
    ) {
      setError("Duration must be between 5 and 180 minutes.");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        candidateId,
        interviewType,
        resumeUrl: hasResume ? resumeUrl : "",
        yearsExperience: hasResume ? (years === null ? null : years) : years,
        durationMinutes,
      };
      const data = await apiFetch("/v1/interviews", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onScheduled?.(data.interview);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const hasResume = Boolean(resumeUrl?.trim());
  const needsYears = !hasResume;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-subtitle">Schedule interview</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="label">Candidate *</label>
            <select
              required
              className="input select-input"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
            >
              <option value="">Select candidate</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.email} ({c.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Interview type *</label>
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
            <p className="mt-1 text-xs text-slate-500">
              Questions can later use resume context, or years of experience if no resume.
            </p>
          </div>

          <div>
            <label className="label">Resume (optional)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf"
              className="input pt-2"
              onChange={onResumeFile}
            />
            {resumeUrl ? (
              <p className="mt-1 text-xs text-emerald-700">Resume attached.</p>
            ) : null}
          </div>

          <div>
            <label className="label">
              Years of experience in this field
              {needsYears ? (
                <span className="text-red-500"> *</span>
              ) : (
                <span className="text-slate-400"> (optional if resume uploaded)</span>
              )}
            </label>
            <input
              type="number"
              min={0}
              max={60}
              step={0.5}
              className="input"
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              placeholder={needsYears ? "e.g. 3" : "Optional"}
              required={needsYears}
            />
          </div>

          <div>
            <label className="label">Duration *</label>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="dur"
                  checked={durationMode === "preset"}
                  onChange={() => setDurationMode("preset")}
                />
                Presets
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="dur"
                  checked={durationMode === "custom"}
                  onChange={() => setDurationMode("custom")}
                />
                Custom (minutes)
              </label>
            </div>
            {durationMode === "preset" ? (
              <select
                className="input select-input mt-2"
                value={durationPreset}
                onChange={(e) => setDurationPreset(Number(e.target.value))}
              >
                {DURATION_PRESETS.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min={5}
                max={180}
                className="input mt-2"
                value={durationCustom}
                onChange={(e) => setDurationCustom(Number(e.target.value))}
              />
            )}
            <p className="mt-1 text-xs text-slate-500">Default demo length is 15 minutes.</p>
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? "Scheduling…" : "Schedule"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}
