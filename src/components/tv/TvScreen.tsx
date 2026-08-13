"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScaleStage } from "@/components/tv/ScaleStage";
import { AmbientBackground } from "@/components/tv/AmbientBackground";
import { BallCanvas, type BallCanvasHandle } from "@/components/tv/BallCanvas";
import { PrizePanel } from "@/components/tv/PrizePanel";
import { DrawEntryModal } from "@/components/tv/DrawEntryModal";
import { DrawErrorModal } from "@/components/tv/DrawErrorModal";
import { ResultModal } from "@/components/tv/ResultModal";
import { StaffLoginModal } from "@/components/tv/StaffLoginModal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PublicPrizeStatus } from "@/types/database";

type Modal = "none" | "entry" | "error" | "result";

export function TvScreen() {
  const [staffAuthed, setStaffAuthed] = useState<boolean | null>(null);
  const [prizes, setPrizes] = useState<PublicPrizeStatus[]>([]);
  const [modal, setModal] = useState<Modal>("none");
  const [errorInfo, setErrorInfo] = useState<{ title: string; description?: string } | null>(null);
  const [pendingResult, setPendingResult] = useState<{ rank: number; name: string } | null>(null);

  const ballCanvasRef = useRef<BallCanvasHandle>(null);

  useEffect(() => {
    fetch("/api/staff/status")
      .then((res) => res.json())
      .then((data) => setStaffAuthed(Boolean(data.authed)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prizes")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setPrizes(data.prizes ?? []);
      });

    try {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel("public:prizes:tv")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "prizes" },
          (payload) => {
            const updated = payload.new as any;
            setPrizes((prev) =>
              prev.map((p) =>
                p.id === updated.id ? { ...p, remaining_quantity: updated.remaining_quantity } : p
              )
            );
          }
        )
        .subscribe();
      return () => {
        cancelled = true;
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {
        cancelled = true;
      };
    }
  }, []);

  const totalRemaining = prizes.reduce((sum, p) => sum + p.remaining_quantity, 0);
  const drawClosed = prizes.length > 0 && totalRemaining <= 0;

  async function performDraw(ticketNumber: string) {
    try {
      const res = await fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketNumber }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "NOT_FOUND") {
          return { type: "error" as const, title: "등록되지 않은 응모번호입니다." };
        }
        if (data.error === "SOLD_OUT") {
          return {
            type: "error" as const,
            title: "모든 상품이 소진되었습니다.",
            description: "이벤트가 종료되어 더 이상 추첨을 진행할 수 없습니다.",
          };
        }
        if (data.error === "UNAUTHORIZED") {
          setStaffAuthed(false);
          return { type: "error" as const, title: "Staff 인증이 만료되었습니다. 다시 인증해주세요." };
        }
        return { type: "error" as const, title: "일시적인 오류가 발생했습니다." };
      }

      if (data.alreadyDrawn) {
        return {
          type: "already" as const,
          rank: data.prizeRank as number,
          name: data.prizeName as string,
        };
      }
      return { type: "success" as const, rank: data.prizeRank as number, name: data.prizeName as string };
    } catch {
      // 네트워크 오류 - 서버 상태를 재확인하여 중복 추첨을 방지한다. (요청사항 58)
      try {
        const statusRes = await fetch(`/api/ticket/${ticketNumber}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.drawn) {
            return {
              type: "already" as const,
              rank: statusData.prizeRank as number,
              name: statusData.prizeName as string,
            };
          }
        }
      } catch {
        // ignore, fall through to network error
      }
      return {
        type: "error" as const,
        title: "네트워크 오류가 발생했습니다.",
        description: "잠시 후 같은 응모번호로 다시 시도해주세요.",
      };
    }
  }

  const handleStartDraw = useCallback(async (ticketNumber: string) => {
    setModal("none");
    const outcome = await performDraw(ticketNumber);

    if (outcome.type === "error") {
      setErrorInfo({ title: outcome.title, description: outcome.description });
      setModal("error");
      return;
    }

    if (outcome.type === "already") {
      setErrorInfo({
        title: "이미 이벤트에 참여한 응모권입니다.",
        description: `추첨 결과: ${outcome.rank}등 · ${outcome.name}`,
      });
      setModal("error");
      return;
    }

    setPendingResult({ rank: outcome.rank, name: outcome.name });
    ballCanvasRef.current?.startDraw(async () => outcome.rank);
  }, []);

  const handleRevealReady = useCallback((_rank: number) => {
    setModal("result");
  }, []);

  return (
    <ScaleStage>
      <div className="absolute inset-0 bg-black">
        <AmbientBackground />

        <div className="absolute left-16 top-10 z-10">
          <div className="text-[15px] font-extrabold tracking-[0.3em] text-white">SH</div>
          <div className="mt-1 text-[13px] font-bold tracking-[0.2em] text-sh-cyan">AI EXPO 2026</div>
          <div className="mt-3 font-display text-[44px] font-black leading-[0.95] text-white">
            LUCKY
            <br />
            DRAW
          </div>
          <div className="mt-4 text-[10px] font-medium tracking-widest text-white/30">
            SEOUL HOUSING &amp; COMMUNITIES CORPORATION
          </div>
        </div>

        <BallCanvas ref={ballCanvasRef} prizes={prizes} onRevealReady={handleRevealReady} />

        <PrizePanel
          prizes={prizes}
          totalRemaining={totalRemaining}
          drawClosed={drawClosed}
          onOpenDraw={() => setModal("entry")}
        />

        {modal === "entry" && (
          <DrawEntryModal onClose={() => setModal("none")} onStart={handleStartDraw} />
        )}

        {modal === "error" && errorInfo && (
          <DrawErrorModal
            title={errorInfo.title}
            description={errorInfo.description}
            onClose={() => {
              setModal("none");
              setErrorInfo(null);
            }}
          />
        )}

        {modal === "result" && pendingResult && (
          <ResultModal
            prizeRank={pendingResult.rank}
            prizeName={pendingResult.name}
            onConfirm={() => {
              setModal("none");
              setPendingResult(null);
            }}
          />
        )}

        {staffAuthed === false && <StaffLoginModal onAuthed={() => setStaffAuthed(true)} />}
      </div>
    </ScaleStage>
  );
}
