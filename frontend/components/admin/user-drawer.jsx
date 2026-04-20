"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export default function UserDrawer({
  open,
  onClose,
  defaultRole = "candidate",
  onCreated,
  onUpdated,
  /** When set, drawer is in edit mode for this user */
  initialUser = null,
  /** Lock role to this value (no dropdown) — e.g. "candidate" on Candidates page */
  fixedRole = null,
}) {
  const isEdit = Boolean(initialUser);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setError("");
      if (initialUser) {
        setName(initialUser.name || "");
        setEmail(initialUser.email || "");
        setPassword("");
        setRole(initialUser.role || defaultRole);
        setAvatarUrl(initialUser.avatarUrl || "");
      } else {
        setName("");
        setEmail("");
        setPassword("");
        setRole(defaultRole);
        setAvatarUrl("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, initialUser, defaultRole]);

  async function onAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (isEdit && password.trim() && password.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && initialUser) {
        const payload = {
          name,
          avatarUrl,
          role: fixedRole ?? role,
        };
        if (password.trim()) {
          payload.password = password;
        }
        const data = await apiFetch(`/v1/auth/users/${initialUser.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onUpdated?.(data.user);
        onClose?.();
        return;
      }

      const data = await apiFetch("/v1/auth/users", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          role: fixedRole ?? role,
          avatarUrl,
        }),
      });
      setName("");
      setEmail("");
      setPassword("");
      setAvatarUrl("");
      setRole(defaultRole);
      onCreated?.(data.user);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const effectiveRole = fixedRole ?? role;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-subtitle">{isEdit ? "Edit user" : "Create New User"}</h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close drawer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              required={!isEdit}
              disabled={isEdit}
              className="input disabled:bg-slate-50 disabled:text-slate-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label">{isEdit ? "New password (optional)" : "Password *"}</label>
            <input
              type="password"
              minLength={isEdit ? undefined : 8}
              required={!isEdit}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? "Leave blank to keep current password" : ""}
            />
          </div>

          {fixedRole ? (
            <div>
              <label className="label">Role</label>
              <p className="input bg-slate-50 text-slate-700 capitalize">{fixedRole}</p>
            </div>
          ) : (
            <div>
              <label className="label">Role *</label>
              <select
                className="input select-input"
                value={effectiveRole}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="candidate">Candidate</option>
                <option value="staff">Admin Staff</option>
              </select>
            </div>
          )}

          <div>
            <label className="label">Profile Photo / Avatar</label>
            <input type="file" accept="image/*" className="input pt-2" onChange={onAvatarChange} />
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="preview"
                width={56}
                height={56}
                unoptimized
                className="mt-3 h-14 w-14 rounded-full object-cover"
              />
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? "Saving…" : isEdit ? "Save" : "Create"}
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
