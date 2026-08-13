"use client";

import { useState } from "react";

export function AdminLoginForm({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("비밀번호가 올바르지 않습니다.");
        setLoading(false);
        return;
      }
      onAuthed();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[380px] rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <div className="text-[13px] font-extrabold tracking-widest text-sh-blue">SH</div>
        <h1 className="mt-1 text-[20px] font-bold text-neutral-900">관리자 로그인</h1>
        <p className="mt-1 text-[13px] text-neutral-400">Lucky Draw 이벤트 관리자 페이지</p>

        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="mt-6 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-[15px] outline-none focus:border-sh-blue focus:bg-white"
        />
        {error && <p className="mt-2 text-[13px] text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="mt-6 w-full rounded-xl bg-sh-blue py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
        >
          {loading ? "확인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
