"use client";

import { useEffect, useState } from "react";
import { LogIn, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import UserDrawer from "@/components/admin/user-drawer";
import Avatar from "@/components/admin/avatar";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";

export default function AdminCandidatesPage() {
  const router = useRouter();
  const { impersonateCandidate } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [impersonateError, setImpersonateError] = useState("");

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

  function closeDrawer() {
    setOpen(false);
    setEditingUser(null);
  }

  function openCreate() {
    setEditingUser(null);
    setOpen(true);
  }

  async function confirmSoftDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    setDeleteSubmitting(true);
    try {
      await apiFetch(`/v1/auth/users/${deleteTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ activeStatus: false }),
      });
      setDeleteTarget(null);
      await refreshCandidates();
    } catch (e) {
      setDeleteError(e.message || "Could not deactivate user");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleImpersonate(candidate) {
    setImpersonateError("");
    try {
      await impersonateCandidate(candidate.id);
      router.push("/dashboard");
    } catch (e) {
      setImpersonateError(e.message || "Could not switch into candidate account");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Candidates"
          subtitle="Candidate list with quick actions"
          right={<Button onClick={openCreate}>+ Create New</Button>}
        />
      </Card>

      {loading ? <LoadingState label="Loading candidates..." /> : null}
      {impersonateError ? <p className="text-sm text-red-600">{impersonateError}</p> : null}

      {!loading && users.length === 0 ? (
        <EmptyState
          title="No candidates found"
          subtitle="Create candidates so they can sign in and use text-only interview practice."
          action={<Button onClick={openCreate}>Create Candidate</Button>}
        />
      ) : null}

      {!loading && users.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="p-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Candidate</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100 text-sm">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        title="Switch to this candidate"
                        className="rounded-full transition hover:opacity-85"
                        onClick={() => handleImpersonate(user)}
                      >
                        <Avatar user={user} />
                      </button>
                      <span className="font-medium text-slate-900">{user.name || "Unnamed candidate"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{user.email}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${user.activeStatus ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                    >
                      {user.activeStatus ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-[#1d4ed8] transition hover:bg-blue-50"
                        title="Switch to candidate"
                        aria-label={`Switch into ${user.name || user.email}`}
                        onClick={() => handleImpersonate(user)}
                      >
                        <LogIn className="h-[18px] w-[18px]" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-[#2563eb] transition hover:bg-blue-50"
                        aria-label={`Edit ${user.name || user.email}`}
                        onClick={() => {
                          setEditingUser(user);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        disabled={!user.activeStatus}
                        className={`rounded-lg p-2 transition ${
                          user.activeStatus
                            ? "text-red-600 hover:bg-red-50"
                            : "cursor-not-allowed text-slate-300"
                        }`}
                        title={user.activeStatus ? "Deactivate candidate" : "Already inactive"}
                        aria-label={`Deactivate ${user.name || user.email}`}
                        onClick={() => {
                          if (user.activeStatus) {
                            setDeleteError("");
                            setDeleteTarget(user);
                          }
                        }}
                      >
                        <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
              </table>
            </div>
          </div>
        </Card>
      ) : null}

      <UserDrawer
        open={open}
        onClose={closeDrawer}
        defaultRole="candidate"
        fixedRole="candidate"
        initialUser={editingUser}
        onCreated={refreshCandidates}
        onUpdated={refreshCandidates}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Deactivate ${deleteTarget.name || deleteTarget.email}?` : "Deactivate candidate?"}
        message={
          deleteTarget
            ? `This will set ${deleteTarget.name || deleteTarget.email} to inactive. They will not be able to sign in until reactivated.`
            : ""
        }
        error={deleteError}
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        danger
        loading={deleteSubmitting}
        onCancel={() => {
          if (deleteSubmitting) return;
          setDeleteTarget(null);
          setDeleteError("");
        }}
        onConfirm={confirmSoftDelete}
      />
    </div>
  );
}
