"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toPng } from "html-to-image";
import { TicketCard } from "@/components/ticket/TicketCard";
import { PrizeRemainingList } from "@/components/ticket/PrizeRemainingList";

type TicketStatus = {
  ticketNumber: string;
  drawn: boolean;
  prizeRank: number | null;
  prizeName: string | null;
};

export default function TicketPage() {
  const params = useParams<{ ticketNumber: string }>();
  const cardRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<TicketStatus | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ticket/${params.ticketNumber}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [params.ticketNumber]);

  async function handleSaveImage() {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `SH_LUCKY_DRAW_${status?.ticketNumber ?? ""}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-white px-8 text-center">
        <p className="text-[15px] text-neutral-500">
          존재하지 않는 응모권입니다.
          <br />
          응모번호를 다시 확인해주세요.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] w-full bg-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col gap-6 px-6 pb-10 pt-10">
        <div>
          <div className="text-[13px] font-extrabold tracking-widest text-sh-blue">SH</div>
          <div className="mt-1 text-[11px] font-semibold tracking-widest text-neutral-400">
            EVENT · LUCKY DRAW
          </div>
        </div>

        {!status ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-sh-blue" />
          </div>
        ) : (
          <>
            <TicketCard ref={cardRef} ticketNumber={status.ticketNumber} />

            {status.drawn && status.prizeName && (
              <div className="rounded-2xl bg-sh-blue/5 px-5 py-4 text-center">
                <p className="text-[12px] font-bold text-sh-blue">추첨이 완료되었습니다</p>
                <p className="mt-1 text-[16px] font-extrabold text-neutral-900">
                  {status.prizeRank}등 · {status.prizeName}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveImage}
              disabled={saving}
              className="w-full rounded-2xl border border-neutral-200 bg-white py-3.5 text-center text-[14px] font-bold text-neutral-700 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {saving ? "저장 중..." : "응모권 이미지 저장"}
            </button>

            <PrizeRemainingList />

            <p className="mt-2 text-center text-[12px] leading-relaxed text-neutral-400">
              현장의 대형 스크린에서
              <br />
              응모번호 <span className="font-bold text-neutral-500">{status.ticketNumber}</span>을 입력하고
              Lucky Draw에 참여해주세요.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
