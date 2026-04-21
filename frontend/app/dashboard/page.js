"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { apiFetch } from "@/lib/api";
import Button from "@/components/ui/button";

const STATUS_LABEL = {
  scheduled: "Scheduled",
  in_progress: "Live",
  completed: "Completed",
  suspended: "Suspended",
  deleted: "Removed",
};

const TYPE_LABEL = {
  technical: "Technical",
  behavioral: "Behavioral",
  system_design: "System design",
};

export default function CandidateDashboardPage() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiFetch("/v1/interviews/mine");
        if (!mounted) return;
        setInterviews(data.interviews || []);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Could not load interviews");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Interviews"
          subtitle={user?.email ? `Signed in as ${user.email}` : "Your interview sessions"}
        />
      </Card>

      {loading ? <LoadingState label="Loading interviews…" /> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && interviews.length === 0 ? (
        <EmptyState
          title="No interviews scheduled"
          subtitle="You don't have any interview sessions scheduled yet. Once scheduled, they will appear here."
          action={
            <Link
              href="/"
              className="text-sm font-semibold text-[#1d4ed8] hover:underline"
            >
              Back to home
            </Link>
          }
        />
      ) : (
        !loading && (
          <Card className="overflow-hidden p-0">
            <div className="p-4">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Room ID</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Scheduled By</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interviews.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100 text-sm">
                          <td className="px-4 py-3 font-mono text-xs text-slate-800">
                            {row.roomId}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {TYPE_LABEL[row.interviewType] || row.interviewType}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {row.durationMinutes} min
                          </td>
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
                          <td className="px-4 py-3 text-slate-600">
                            {row.scheduledBy?.name || row.scheduledBy?.email || "Admin"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {row.createdAt
                              ? new Date(row.createdAt).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.status === "scheduled" || row.status === "in_progress" ? (
                              <Link href={`/dashboard/interviews/${row.roomId}`}>
                                <Button
                                  type="button"
                                  className="px-3 py-2 text-xs"
                                  variant={row.status === "in_progress" ? "secondary" : "primary"}
                                >
                                  {row.status === "in_progress" ? "Resume" : "Start"}
                                </Button>
                              </Link>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>
        )
      )}
    </div>
  );
}
