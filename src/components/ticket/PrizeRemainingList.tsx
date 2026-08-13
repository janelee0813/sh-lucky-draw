"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PublicPrizeStatus } from "@/types/database";

export function PrizeRemainingList() {
  const [prizes, setPrizes] = useState<PublicPrizeStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/prizes")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setPrizes(data.prizes ?? []);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));

    try {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel("public:prizes:ticket")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "prizes" },
          (payload) => {
            const updated = payload.new as any;
            setPrizes((prev) =>
              prev.map((p) => (p.id === updated.id ? { ...p, remaining_quantity: updated.remaining_quantity } : p))
            );
          }
        )
        .subscribe();

      return () => {
        cancelled = true;
        supabase.removeChannel(channel);
      };
    } catch {
      // Supabase 환경변수가 없는 로컬 빌드 환경 등에서는 realtime을 건너뛴다.
      return () => {
        cancelled = true;
      };
    }
  }, []);

  const total = prizes.reduce((sum, p) => sum + p.remaining_quantity, 0);

  if (loading) {
    return <div className="h-24 animate-pulse rounded-2xl bg-neutral-100" />;
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-bold tracking-widest text-neutral-400">
          남은 상품
        </span>
        <span className="text-[22px] font-black text-sh-blue">{total}개</span>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {prizes.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-[13px]">
            <span className="text-neutral-600">{p.name}</span>
            <span className={`font-bold ${p.remaining_quantity === 0 ? "text-neutral-300" : "text-neutral-900"}`}>
              {p.remaining_quantity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
