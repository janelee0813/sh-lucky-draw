"use client";

import { useEffect, useState } from "react";

type PrizeRow = {
  id: string;
  rank: number;
  name: string;
  initial_quantity: number;
  remaining_quantity: number;
  won_quantity: number;
};

export function PrizesTable() {
  const [prizes, setPrizes] = useState<PrizeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/prizes");
    const data = await res.json();
    setPrizes(data.prizes ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/prizes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initial_quantity: Number(editValue) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "수정에 실패했습니다.");
      return;
    }
    setEditingId(null);
    load();
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-[16px] font-bold text-neutral-900">상품 현황</h2>

      {error && <p className="mt-2 text-[13px] text-red-500">{error}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-neutral-100 text-neutral-400">
              <th className="py-2 pr-4 font-semibold">등수</th>
              <th className="py-2 pr-4 font-semibold">상품</th>
              <th className="py-2 pr-4 font-semibold text-right">최초 수량</th>
              <th className="py-2 pr-4 font-semibold text-right">당첨</th>
              <th className="py-2 pr-4 font-semibold text-right">남은 수량</th>
              <th className="py-2 pr-4 font-semibold text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-300">
                  불러오는 중...
                </td>
              </tr>
            ) : (
              prizes.map((p) => (
                <tr key={p.id} className="border-b border-neutral-50">
                  <td className="py-3 pr-4 font-bold text-neutral-900">{p.rank}</td>
                  <td className="py-3 pr-4 text-neutral-700">{p.name}</td>
                  <td className="py-3 pr-4 text-right">
                    {editingId === p.id ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-20 rounded-lg border border-neutral-200 px-2 py-1 text-right"
                      />
                    ) : (
                      p.initial_quantity
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right text-neutral-500">{p.won_quantity}</td>
                  <td className="py-3 pr-4 text-right font-bold text-sh-blue">{p.remaining_quantity}</td>
                  <td className="py-3 pr-4 text-right">
                    {editingId === p.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSave(p.id)}
                          className="rounded-lg bg-sh-blue px-3 py-1 text-white"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-neutral-200 px-3 py-1"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(p.id);
                          setEditValue(String(p.initial_quantity));
                          setError(null);
                        }}
                        className="rounded-lg border border-neutral-200 px-3 py-1 text-neutral-500 hover:border-neutral-300"
                      >
                        수정
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
