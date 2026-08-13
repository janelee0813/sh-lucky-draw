"use client";

export function StatsCards({
  stats,
}: {
  stats: {
    totalParticipants: number;
    drawnCount: number;
    pendingDrawCount: number;
    remainingPrizes: number;
  } | null;
}) {
  const items = [
    { label: "총 설문 참여", value: stats?.totalParticipants },
    { label: "추첨 완료", value: stats?.drawnCount },
    { label: "추첨 대기", value: stats?.pendingDrawCount },
    { label: "남은 상품", value: stats?.remainingPrizes },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="text-[12px] font-semibold text-neutral-400">{item.label}</div>
          <div className="mt-2 text-[28px] font-black text-neutral-900">
            {item.value ?? <span className="text-neutral-200">–</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
