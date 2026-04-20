"use client";

import { useEffect, useState } from "react";
import UserDrawer from "@/components/admin/user-drawer";
import Avatar from "@/components/admin/avatar";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { apiFetch } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function loadUsers() {
    const data = await apiFetch("/v1/auth/users?role=admin,staff");
    setUsers(data.users || []);
  }

  async function refreshUsers() {
    setLoading(true);
    try {
      await loadUsers();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiFetch("/v1/auth/users?role=admin,staff");
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
          title="Users"
          subtitle="Admin and staff accounts"
          right={<Button onClick={() => setOpen(true)}>+ Create New</Button>}
        />
      </Card>

      {loading ? <LoadingState label="Loading users..." /> : null}

      {!loading && users.length === 0 ? (
        <EmptyState
          title="No users found"
          subtitle="Create an admin staff account to start managing the platform."
          action={<Button onClick={() => setOpen(true)}>Create User</Button>}
        />
      ) : null}

      {!loading && users.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="p-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100 text-sm">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar user={user} />
                      <span className="font-medium text-slate-900">{user.name || "Unnamed user"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{user.email}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs ${user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {user.role === "admin" ? "Super Admin" : "Admin Staff"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
              </table>
            </div>
          </div>
        </Card>
      ) : null}

      <UserDrawer open={open} onClose={() => setOpen(false)} defaultRole="staff" onCreated={refreshUsers} />
    </div>
  );
}
