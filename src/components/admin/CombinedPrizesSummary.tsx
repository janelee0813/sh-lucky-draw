"use client";

type PrizeBreakdownRow = {
  rank: number;
  name: string;
  initial_quantity: number;
  won_quantity: number;
  remaining_quantity: number;
};

// 대시보드용 상품 현황 - 1차(보관) + 2차(라이브) 수량을 등수 기준으로 합산해서 보여준다.
// 실제 재고 수정은 PRIZES 탭의 PrizesTable(라이브 전용)에서만 한다.
export function CombinedPrizesSummary({ prizes }: { prizes: PrizeBreakdownRow[] | undefined }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-[16px] font-bold text-neutral-900">상품 현황 (1차+2차 합계)</h2>
      <p className="mt-1 text-[12px] text-neutral-400">
        남은 수량은 지금 진행 중인 라운드에서 실제로 뽑을 수 있는 재고만 표시합니다.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-neutral-100 text-neutral-400">
              <th className="py-2 pr-4 font-semibold">등수</th>
              <th className="py-2 pr-4 font-semibold">상품</th>
              <th className="py-2 pr-4 font-semibold text-right">총 수량</th>
              <th className="py-2 pr-4 font-semibold text-right">당첨(누적)</th>
              <th className="py-2 pr-4 font-semibold text-right">현재 남은 수량</th>
            </tr>
          </thead>
          <tbody>
            {!prizes ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-neutral-300">
                  불러오는 중...
                </td>
              </tr>
            ) : (
              prizes.map((p) => (
                <tr key={`${p.rank}-${p.name}`} className="border-b border-neutral-50">
                  <td className="py-3 pr-4 font-bold text-neutral-900">{p.rank}</td>
                  <td className="py-3 pr-4 text-neutral-700">{p.name}</td>
                  <td className="py-3 pr-4 text-right">{p.initial_quantity}</td>
                  <td className="py-3 pr-4 text-right text-neutral-500">{p.won_quantity}</td>
                  <td className="py-3 pr-4 text-right font-bold text-sh-blue">{p.remaining_quantity}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
