"use client";

import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export default function CandidateDashboardPage() {
  const { user } = useAuth();
  const interviews = [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Interviews"
          subtitle={user?.email ? `Signed in as ${user.email}` : "Your interview sessions"}
        />
      </Card>

      {interviews.length === 0 ? (
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-700">Your upcoming interviews will appear here.</p>
        </div>
      )}
    </div>
  );
}
