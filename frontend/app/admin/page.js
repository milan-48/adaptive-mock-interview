"use client";

import { useEffect, useState } from "react";
import UserDrawer from "@/components/admin/user-drawer";
import Avatar from "@/components/admin/avatar";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { apiFetch } from "@/lib/api";

export default function AdminCandidatesPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function loadCandidates() {
    const data = await apiFetch("/v1/auth/users?role=candidate");
    setUsers(data.users || []);
  }

  async function refreshCandidates() {
    setLoading(true);
    try {
      await loadCandidates();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiFetch("/v1/auth/users?role=candidate");
        if (mounted) setUsers(data.users || []);
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
          title="Candidates"
          subtitle="Candidate list with quick actions"
          right={<Button onClick={() => setOpen(true)}>+ Create New</Button>}
        />
      </Card>

      {loading ? <LoadingState label="Loading candidates..." /> : null}

      {!loading && users.length === 0 ? (
        <EmptyState
          title="No candidates found"
          subtitle="Create your first candidate to start interviews and session tracking."
          action={<Button onClick={() => setOpen(true)}>Create Candidate</Button>}
        />
      ) : null}

      {!loading && users.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Candidate</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100 text-sm">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar user={user} />
                      <span className="font-medium text-slate-900">{user.name || "Unnamed candidate"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{user.email}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs ${user.activeStatus ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {user.activeStatus ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <UserDrawer open={open} onClose={() => setOpen(false)} defaultRole="candidate" onCreated={refreshCandidates} />
    </div>
  );
}
