"use client";

import { useState } from "react";

export function ResetPanel() {
  const [openScope, setOpenScope] = useState<"prizes_only" | "full" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleReset() {
    if (!openScope || confirmText !== "RESET") return;
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: openScope, confirmText }),
    });
    setLoading(false);
    if (res.ok) {
      setMessage("초기화가 완료되었습니다. 페이지를 새로고침합니다.");
      setTimeout(() => window.location.reload(), 1200);
    } else {
      const data = await res.json().catch(() => null);
      setMessage(
        `초기화에 실패했습니다. (${res.status} ${data?.error ?? ""}${data?.message ? `: ${data.message}` : ""})`
      );
    }
    setOpenScope(null);
    setConfirmText("");
  }

  return (
    <div className="rounded-2xl border border-red-100 bg-red-50/40 p-6">
      <h2 className="text-[16px] font-bold text-red-600">이벤트 데이터 초기화</h2>
      <p className="mt-1 text-[13px] text-red-400">
        되돌릴 수 없는 작업입니다. 실제 행사 전 리허설 데이터를 정리할 때만 사용하세요.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={() => setOpenScope("prizes_only")}
          className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50"
        >
          상품 재고만 초기화
        </button>
        <button
          onClick={() => setOpenScope("full")}
          className="rounded-xl bg-red-500 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-red-600"
        >
          참가자 + 당첨 데이터 전체 초기화
        </button>
      </div>

      {message && <p className="mt-3 text-[13px] text-neutral-500">{message}</p>}

      {openScope && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-[420px] rounded-2xl bg-white p-7">
            <h3 className="text-[16px] font-bold text-neutral-900">
              정말 {openScope === "full" ? "참가자+당첨 데이터 전체" : "상품 재고"}를
              초기화하시겠습니까?
            </h3>
            <p className="mt-2 text-[13px] text-neutral-500">
              이 작업은 되돌릴 수 없습니다.
              <br />
              초기화하려면 아래에 <b>RESET</b>을 입력해주세요.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET"
              className="mt-4 w-full rounded-xl border border-neutral-200 px-4 py-3 text-center text-[15px] tracking-widest outline-none focus:border-red-400"
            />
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setOpenScope(null);
                  setConfirmText("");
                }}
                className="flex-1 rounded-xl border border-neutral-200 py-3 text-[14px] font-semibold text-neutral-600"
              >
                취소
              </button>
              <button
                onClick={handleReset}
                disabled={confirmText !== "RESET" || loading}
                className="flex-1 rounded-xl bg-red-500 py-3 text-[14px] font-bold text-white disabled:opacity-40"
              >
                {loading ? "처리 중..." : "초기화 실행"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
