"use client";

import { useEffect, useState } from "react";

type PrizeInput = { rank: number; name: string; initial_quantity: number; display_order: number };

// 상품명은 1차와 동일하게 유지하고, 수량만 2차 기준(1·5·30·40·74 = 150개)으로 채워둔다.
const DEFAULT_PRIZES: PrizeInput[] = [
  { rank: 1, name: "AirPods 4", initial_quantity: 1, display_order: 1 },
  { rank: 2, name: "Belkin 충전기", initial_quantity: 5, display_order: 2 },
  { rank: 3, name: "Re:QM 여행용 충전기", initial_quantity: 30, display_order: 3 },
  { rank: 4, name: "편의점 상품권 3,000원", initial_quantity: 40, display_order: 4 },
  { rank: 5, name: "Haribo 젤리 간식", initial_quantity: 74, display_order: 5 },
];

export function StartRoundPanel() {
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [prizes, setPrizes] = useState<PrizeInput[]>(DEFAULT_PRIZES);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => setCurrentRound(data?.settings?.current_round ?? 1));
  }, []);

  const total = prizes.reduce((sum, p) => sum + (Number.isFinite(p.initial_quantity) ? p.initial_quantity : 0), 0);

  function updateQuantity(rank: number, value: string) {
    const n = Number(value);
    setPrizes((prev) =>
      prev.map((p) => (p.rank === rank ? { ...p, initial_quantity: Number.isFinite(n) ? n : 0 } : p))
    );
  }

  function updateName(rank: number, value: string) {
    setPrizes((prev) => prev.map((p) => (p.rank === rank ? { ...p, name: value } : p)));
  }

  async function handleStart() {
    if (confirmText !== "START") return;
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/round/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prizes, confirmText }),
    });
    setLoading(false);
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setMessage(`${data.newRound}차 라운드가 시작되었습니다. 페이지를 새로고침합니다.`);
      setTimeout(() => window.location.reload(), 1200);
    } else {
      setMessage(`시작에 실패했습니다. (${res.status} ${data?.error ?? ""}${data?.message ? `: ${data.message}` : ""})`);
    }
    setConfirmOpen(false);
    setConfirmText("");
  }

  return (
    <div className="rounded-2xl border border-sh-blue/20 bg-sh-blue/5 p-6">
      <h2 className="text-[16px] font-bold text-neutral-900">다음 라운드 시작</h2>
      <p className="mt-1 text-[13px] text-neutral-500">
        현재 {currentRound ?? "-"}차 참가자·추첨 기록·상품 재고를 전부 보관 테이블로 옮겨 영구 보존한 뒤,
        아래 상품 구성으로 라이브 데이터를 새로 시작합니다. 응모권 번호는 1번부터 다시 시작됩니다.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-neutral-100 text-neutral-400">
              <th className="py-2 pr-4 font-semibold">등수</th>
              <th className="py-2 pr-4 font-semibold">상품명</th>
              <th className="py-2 pr-4 font-semibold text-right">수량</th>
            </tr>
          </thead>
          <tbody>
            {prizes.map((p) => (
              <tr key={p.rank} className="border-b border-neutral-50">
                <td className="py-2 pr-4 font-bold text-neutral-900">{p.rank}</td>
                <td className="py-2 pr-4">
                  <input
                    value={p.name}
                    onChange={(e) => updateName(p.rank, e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-2 py-1"
                  />
                </td>
                <td className="py-2 pr-4 text-right">
                  <input
                    type="number"
                    value={p.initial_quantity}
                    onChange={(e) => updateQuantity(p.rank, e.target.value)}
                    className="w-20 rounded-lg border border-neutral-200 px-2 py-1 text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[13px] font-semibold text-sh-blue">총 {total}개</p>

      <button
        onClick={() => setConfirmOpen(true)}
        className="mt-4 rounded-xl bg-sh-blue px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
      >
        다음 라운드 시작하기
      </button>

      {message && <p className="mt-3 text-[13px] text-neutral-500">{message}</p>}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-[420px] rounded-2xl bg-white p-7">
            <h3 className="text-[16px] font-bold text-neutral-900">
              정말 새 라운드(총 {total}개)를 시작하시겠습니까?
            </h3>
            <p className="mt-2 text-[13px] text-neutral-500">
              현재 라운드 데이터는 보관 테이블로 안전하게 옮겨지지만, 라이브 화면(TV/응모/추첨)에서는
              더 이상 보이지 않습니다.
              <br />
              시작하려면 아래에 <b>START</b>를 입력해주세요.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="START"
              className="mt-4 w-full rounded-xl border border-neutral-200 px-4 py-3 text-center text-[15px] tracking-widest outline-none focus:border-sh-blue"
            />
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                }}
                className="flex-1 rounded-xl border border-neutral-200 py-3 text-[14px] font-semibold text-neutral-600"
              >
                취소
              </button>
              <button
                onClick={handleStart}
                disabled={confirmText !== "START" || loading}
                className="flex-1 rounded-xl bg-sh-blue py-3 text-[14px] font-bold text-white disabled:opacity-40"
              >
                {loading ? "처리 중..." : "시작"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
