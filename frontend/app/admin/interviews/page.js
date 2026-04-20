"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import ScheduleInterviewDrawer from "@/components/admin/schedule-interview-drawer";
import Avatar from "@/components/admin/avatar";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { apiFetch } from "@/lib/api";

const STATUS_LABEL = {
  scheduled: "Scheduled",
  in_progress: "Live",
  completed: "Completed",
  suspended: "Suspended",
  deleted: "Removed",
};

const STATUS_OPTIONS = [
  "scheduled",
  "in_progress",
  "completed",
  "suspended",
  "deleted",
];

const TYPE_LABEL = {
  technical: "Technical",
  behavioral: "Behavioral",
  system_design: "System design",
  mixed: "Mixed",
  other: "Other",
};

export default function AdminInterviewsPage() {
  const [interviews, setInterviews] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const [iv, cand] = await Promise.all([
      apiFetch("/v1/interviews"),
      apiFetch("/v1/auth/users?role=candidate"),
    ]);
    setInterviews(iv.interviews || []);
    setCandidates(cand.users || []);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await load();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [load]);

  const filteredInterviews = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return interviews;
    return interviews.filter((row) => {
      const room = (row.roomId || "").toLowerCase();
      const roomCompact = room.replace(/-/g, "");
      const qCompact = needle.replace(/-/g, "").replace(/\s+/g, "");
      const name = (row.candidate?.name || "").toLowerCase();
      const email = (row.candidate?.email || "").toLowerCase();
      return (
        room.includes(needle) ||
        (qCompact.length > 0 && roomCompact.includes(qCompact)) ||
        name.includes(needle) ||
        email.includes(needle)
      );
    });
  }, [interviews, search]);

  async function updateStatus(id, status) {
    setUpdatingId(id);
    try {
      const body = { status };
      if (status === "suspended") {
        const reason = window.prompt("Reason for suspension (optional)") || "";
        body.suspendedReason = reason;
      }
      await apiFetch(`/v1/interviews/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await load();
    } catch (e) {
      window.alert(e.message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Interviews"
          subtitle="Schedule sessions, room IDs, and status"
          right={
            <Button type="button" onClick={() => setOpen(true)}>
              + Schedule interview
            </Button>
          }
        />
      </Card>

      {loading ? <LoadingState label="Loading interviews…" /> : null}

      {!loading && interviews.length === 0 ? (
        <EmptyState
          title="No interviews yet"
          subtitle="Schedule an interview for a candidate. Each session gets a unique room ID for access control."
          action={<Button onClick={() => setOpen(true)}>Schedule interview</Button>}
        />
      ) : null}

      {!loading && interviews.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div className="flex justify-end border-b border-slate-100 py-3">
              <label className="relative block w-full max-w-md min-w-0">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  type="search"
                  className="input w-full !pl-10 pr-3"
                  placeholder="Search by room ID, candidate name, or email…"
                  aria-label="Search interviews by room ID, candidate name, or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
                />
              </label>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Room ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInterviews.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        No interviews match your search.
                      </td>
                    </tr>
                  ) : null}
                  {filteredInterviews.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 text-sm">
                      <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar user={row.candidate} />
                        <div>
                          <div className="font-medium text-slate-900">
                            {row.candidate?.name || "—"}
                          </div>
                          <div className="text-xs text-slate-500">{row.candidate?.email}</div>
                        </div>
                      </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-800">
                        {row.roomId}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {TYPE_LABEL[row.interviewType] || row.interviewType}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.durationMinutes} min</td>
                      <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          row.status === "scheduled"
                            ? "bg-sky-100 text-sky-800"
                            : row.status === "in_progress"
                              ? "bg-violet-100 text-violet-800"
                              : row.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : row.status === "suspended"
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {STATUS_LABEL[row.status] || row.status}
                      </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="input select-input max-w-[200px] py-2 text-xs"
                          value={row.status}
                          disabled={updatingId === row.id}
                          onChange={(e) => updateStatus(row.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <ScheduleInterviewDrawer
        open={open}
        onClose={() => setOpen(false)}
        candidates={candidates}
        onScheduled={load}
      />
    </div>
  );
}
