"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScaleStage } from "@/components/tv/ScaleStage";
import { AmbientBackground } from "@/components/tv/AmbientBackground";
import { BallCanvas, type BallCanvasHandle } from "@/components/tv/BallCanvas";
import { RouletteCanvas, type RouletteCanvasHandle } from "@/components/tv/RouletteCanvas";
import { PrizePanel } from "@/components/tv/PrizePanel";
import { DrawEntryModal } from "@/components/tv/DrawEntryModal";
import { DrawErrorModal } from "@/components/tv/DrawErrorModal";
import { ResultModal } from "@/components/tv/ResultModal";
import { StaffLoginModal } from "@/components/tv/StaffLoginModal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PublicPrizeStatus } from "@/types/database";

type Modal = "none" | "entry" | "error" | "result";
type DisplayMode = "ball" | "roulette";

export function TvScreen() {
  const [staffAuthed, setStaffAuthed] = useState<boolean | null>(null);
  const [prizes, setPrizes] = useState<PublicPrizeStatus[]>([]);
  const [modal, setModal] = useState<Modal>("none");
  const [errorInfo, setErrorInfo] = useState<{ title: string; description?: string } | null>(null);
  const [pendingResult, setPendingResult] = useState<{ rank: number; name: string } | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("roulette");

  const ballCanvasRef = useRef<BallCanvasHandle>(null);
  const rouletteCanvasRef = useRef<RouletteCanvasHandle>(null);

  // 추첨 애니메이션이 도는 동안에는 실시간/폴링으로 들어오는 재고 갱신을 화면에 바로
  // 반영하지 않는다. (그렇지 않으면 룰렛이 멈추기 전에 우측 상품 패널 숫자가 먼저 줄어들어
  // 결과가 미리 보이는 문제가 있었다) 애니메이션이 결과를 보여주는 순간(onRevealReady)에
  // 쌓아둔 최신 재고를 한 번에 반영한다.
  const isDrawingRef = useRef(false);
  const pendingPrizesRef = useRef<PublicPrizeStatus[] | null>(null);
  const prizesRef = useRef<PublicPrizeStatus[]>([]);
  useEffect(() => {
    prizesRef.current = prizes;
  }, [prizes]);

  useEffect(() => {
    fetch("/api/staff/status")
      .then((res) => res.json())
      .then((data) => setStaffAuthed(Boolean(data.authed)));
  }, []);

  useEffect(() => {
    let cancelled = false;

    function loadPrizes() {
      fetch("/api/prizes")
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const next = data.prizes ?? [];
          if (isDrawingRef.current) {
            pendingPrizesRef.current = next;
          } else {
            setPrizes(next);
          }
        })
        .catch(() => {});
    }

    loadPrizes();

    // Realtime 구독이 (네트워크/방화벽 등으로) 조용히 끊기더라도 화면이 계속 오래된 재고
    // 숫자를 보여주는 일이 없도록, 짧은 주기로 항상 최신 상태를 다시 가져온다.
    const pollTimer = setInterval(loadPrizes, 5000);

    let removeChannel: (() => void) | null = null;
    try {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel("public:prizes:tv")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "prizes" },
          (payload) => {
            const updated = payload.new as any;
            const applyUpdate = (prev: PublicPrizeStatus[]) =>
              prev.map((p) =>
                p.id === updated.id ? { ...p, remaining_quantity: updated.remaining_quantity } : p
              );
            if (isDrawingRef.current) {
              pendingPrizesRef.current = applyUpdate(pendingPrizesRef.current ?? prizesRef.current);
            } else {
              setPrizes(applyUpdate);
            }
          }
        )
        .subscribe();
      removeChannel = () => supabase.removeChannel(channel);
    } catch {
      removeChannel = null;
    }

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      removeChannel?.();
    };
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
    // 추첨 애니메이션이 끝나기 전까지는 재고 갱신이 화면에 새어나가지 않도록 막는다.
    isDrawingRef.current = true;
    const outcome = await performDraw(ticketNumber);

    if (outcome.type === "error") {
      isDrawingRef.current = false;
      pendingPrizesRef.current = null;
      setErrorInfo({ title: outcome.title, description: outcome.description });
      setModal("error");
      return;
    }

    if (outcome.type === "already") {
      isDrawingRef.current = false;
      pendingPrizesRef.current = null;
      setErrorInfo({
        title: "이미 이벤트에 참여한 응모권입니다.",
        description: `추첨 결과: ${outcome.rank}등 · ${outcome.name}`,
      });
      setModal("error");
      return;
    }

    setPendingResult({ rank: outcome.rank, name: outcome.name });
    const activeRef = displayMode === "ball" ? ballCanvasRef : rouletteCanvasRef;
    activeRef.current?.startDraw(async () => outcome.rank);
  }, [displayMode]);

  const handleRevealReady = useCallback((_rank: number) => {
    // 룰렛/공이 결과를 보여주는 바로 이 순간에, 그동안 쌓아뒀던 최신 재고를 한 번에 반영한다.
    isDrawingRef.current = false;
    if (pendingPrizesRef.current) {
      setPrizes(pendingPrizesRef.current);
      pendingPrizesRef.current = null;
    }
    setModal("result");
  }, []);

  return (
    <ScaleStage>
      <div className="absolute inset-0 bg-black">
        <AmbientBackground />

        <div className="absolute left-16 top-10 z-10">
          <div className="flex items-baseline gap-2.5 whitespace-nowrap">
            <span className="text-[15px] font-extrabold tracking-[0.3em] text-white">SH</span>
            <span className="text-[13px] font-bold tracking-[0.2em] text-sh-cyan">
              AI Summit Seoul &amp; Expo
            </span>
          </div>
          <div className="mt-3 whitespace-nowrap font-display text-[44px] font-black leading-none text-white">
            LUCKY DRAW
          </div>
          <div className="mt-4 text-[10px] font-medium tracking-widest text-white/30">
            Seoul Housing &amp; Urban Development Corporation
          </div>
        </div>

        {displayMode === "ball" ? (
          <BallCanvas ref={ballCanvasRef} prizes={prizes} onRevealReady={handleRevealReady} />
        ) : (
          <RouletteCanvas ref={rouletteCanvasRef} prizes={prizes} onRevealReady={handleRevealReady} />
        )}

        <button
          type="button"
          onClick={() => setDisplayMode((m) => (m === "ball" ? "roulette" : "ball"))}
          className="absolute z-20 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[9px] font-medium text-white/40 backdrop-blur-sm transition-colors hover:border-white/30 hover:text-white/80"
          style={{ top: 162, right: 668 }}
        >
          전환
        </button>

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
