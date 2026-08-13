"use client";

import { useState } from "react";

export function StaffLoginModal({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/login", {
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
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-[440px] rounded-[28px] border border-white/10 bg-[#0A1230] p-10 text-center"
      >
        <div className="text-[13px] font-extrabold tracking-widest text-sh-cyan">STAFF ACCESS</div>
        <p className="mt-2 text-[13px] text-white/40">
          현장 운영자 인증 후 행사 동안 계속 사용할 수 있습니다.
        </p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="STAFF PASSWORD"
          className="mt-6 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-center text-[16px] tracking-widest text-white outline-none focus:border-sh-cyan"
        />
        {error && <p className="mt-3 text-[13px] text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-sh-blue to-sh-cyan py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
        >
          {loading ? "확인 중..." : "인증"}
        </button>
      </form>
    </div>
  );
}
