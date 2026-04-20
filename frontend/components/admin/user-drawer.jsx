"use client";

import Image from "next/image";
import { useState } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export default function UserDrawer({ open, onClose, defaultRole = "candidate", onCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
    setSubmitting(true);
    try {
      const data = await apiFetch("/v1/auth/users", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role, avatarUrl }),
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

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-subtitle">Create New User</h3>
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
            <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div>
            <label className="label">Password *</label>
            <input type="password" minLength={8} required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div>
            <label className="label">Role *</label>
            <select className="input select-input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="candidate">Candidate</option>
              <option value="staff">Admin Staff</option>
            </select>
          </div>

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
              {submitting ? "Creating..." : "Create"}
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
