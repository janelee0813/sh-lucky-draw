"use client";

import { useEffect, useState } from "react";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/admin/status")
      .then((res) => res.json())
      .then((data) => setAuthed(Boolean(data.authed)));
  }, []);

  if (authed === null) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-sh-blue" />
      </div>
    );
  }

  if (!authed) {
    return <AdminLoginForm onAuthed={() => setAuthed(true)} />;
  }

  return <AdminDashboard />;
}
