"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { BALL_SIZE, VISUAL_BALL_COUNT } from "@/lib/config/settings";
import type { PublicPrizeStatus } from "@/types/database";

const CANVAS_WIDTH = 1536;
const CANVAS_HEIGHT = 1080;

// 구슬이 떠다니는 영역을 라운드 사각형으로 한정한다 (상단은 로고 텍스트를 피해 여유를 둔다).
const STAGE_LEFT = 56;
const STAGE_TOP = 230;
const STAGE_RIGHT = CANVAS_WIDTH - 56;
const STAGE_BOTTOM = CANVAS_HEIGHT - 56;
const STAGE_CORNER_RADIUS = 40;

const RANK_COLOR: Record<number, { core: string; glow: string }> = {
  1: { core: "#FFFFFF", glow: "rgba(255,255,255,0.9)" },
  2: { core: "#31E7FF", glow: "rgba(49,231,255,0.85)" },
  3: { core: "#4C8CFF", glow: "rgba(76,140,255,0.8)" },
  4: { core: "#7B8CFF", glow: "rgba(123,140,255,0.6)" },
  5: { core: "#5D6B8C", glow: "rgba(93,107,140,0.5)" },
};

interface Ball {
  id: string;
  rank: number;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phaseOffset: number;
  selected: boolean;
  removing: boolean;
  opacity: number;
}

type Phase = "idle" | "accelerate" | "converge" | "settle" | "highlight" | "reveal";

export type BallCanvasHandle = {
  startDraw: (getWinningRank: () => Promise<number | null>) => void;
};

export const BallCanvas = forwardRef<
  BallCanvasHandle,
  {
    prizes: PublicPrizeStatus[];
    onRevealReady: (rank: number) => void;
  }
>(function BallCanvas({ prizes, onRevealReady }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const phaseRef = useRef<Phase>("idle");
  const phaseStartRef = useRef<number>(0);
  const winningRankRef = useRef<number | null>(null);
  const selectedBallIdRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);

  // 상품 재고 변화에 따라 Ball 목록을 재구성한다.
  useEffect(() => {
    const nextBalls: Ball[] = [];
    const existing = new Map(ballsRef.current.map((b) => [b.id, b]));

    for (const prize of prizes) {
      const rank = prize.rank;
      let count = 0;
      if (rank === 1 || rank === 2 || rank === 3) {
        count = prize.remaining_quantity;
      } else {
        count = prize.remaining_quantity > 0 ? VISUAL_BALL_COUNT[rank as 4 | 5] : 0;
      }

      for (let i = 0; i < count; i++) {
        const id = `${rank}-${i}`;
        const prev = existing.get(id);
        if (prev) {
          nextBalls.push(prev);
        } else {
          const radius = BALL_SIZE[rank as 1 | 2 | 3 | 4 | 5] / 2;
          nextBalls.push({
            id,
            rank,
            radius,
            x: STAGE_LEFT + radius + Math.random() * (STAGE_RIGHT - STAGE_LEFT - radius * 2),
            y: STAGE_TOP + radius + Math.random() * (STAGE_BOTTOM - STAGE_TOP - radius * 2),
            vx: (Math.random() - 0.5) * 1.8,
            vy: (Math.random() - 0.5) * 1.8,
            phaseOffset: Math.random() * Math.PI * 2,
            selected: false,
            removing: false,
            opacity: 1,
          });
        }
      }
    }
    ballsRef.current = nextBalls;
  }, [prizes]);

  useImperativeHandle(ref, () => ({
    startDraw(getWinningRank: () => Promise<number | null>) {
      phaseRef.current = "accelerate";
      phaseStartRef.current = performance.now();
      winningRankRef.current = null;
      selectedBallIdRef.current = null;
      ballsRef.current.forEach((b) => {
        b.selected = false;
        b.removing = false;
        b.opacity = 1;
      });

      getWinningRank().then((rank) => {
        winningRankRef.current = rank;
      });
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const centerX = (STAGE_LEFT + STAGE_RIGHT) / 2;
    const centerY = (STAGE_TOP + STAGE_BOTTOM) / 2;

    function drawStageFrame() {
      const r = STAGE_CORNER_RADIUS;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(STAGE_LEFT + r, STAGE_TOP);
      ctx.arcTo(STAGE_RIGHT, STAGE_TOP, STAGE_RIGHT, STAGE_BOTTOM, r);
      ctx.arcTo(STAGE_RIGHT, STAGE_BOTTOM, STAGE_LEFT, STAGE_BOTTOM, r);
      ctx.arcTo(STAGE_LEFT, STAGE_BOTTOM, STAGE_LEFT, STAGE_TOP, r);
      ctx.arcTo(STAGE_LEFT, STAGE_TOP, STAGE_RIGHT, STAGE_TOP, r);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.stroke();
      ctx.restore();
    }

    function pickSelectedBall(): Ball | null {
      const rank = winningRankRef.current;
      const balls = ballsRef.current;
      if (rank == null) return null;
      const candidates = balls.filter((b) => b.rank === rank);
      if (candidates.length === 0) return balls[Math.floor(Math.random() * balls.length)] ?? null;
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function tick(now: number) {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawStageFrame();
      const balls = ballsRef.current;
      const phase = phaseRef.current;
      const elapsed = now - phaseStartRef.current;

      // ---- Phase 전환 로직 (요청사항 21의 8~9초 시퀀스) ----
      if (phase === "accelerate" && elapsed > 2000) {
        phaseRef.current = "converge";
        phaseStartRef.current = now;
      } else if (phase === "converge" && elapsed > 3000) {
        phaseRef.current = "settle";
        phaseStartRef.current = now;
      } else if (phase === "settle" && elapsed > 2000) {
        phaseRef.current = "highlight";
        phaseStartRef.current = now;
      } else if (phase === "highlight" && elapsed > 1000) {
        // 결과가 아직 서버에서 오지 않았다면 highlight를 유지하며 대기한다.
        if (winningRankRef.current !== null) {
          const chosen = pickSelectedBall();
          if (chosen) {
            chosen.selected = true;
            selectedBallIdRef.current = chosen.id;
          }
          phaseRef.current = "reveal";
          phaseStartRef.current = now;
        }
      } else if (phase === "reveal" && elapsed > 1000) {
        if (winningRankRef.current !== null) {
          onRevealReady(winningRankRef.current);
          phaseRef.current = "idle";
        }
      }

      for (const b of balls) {
        const isSelected = b.id === selectedBallIdRef.current;
        const colors = RANK_COLOR[b.rank] ?? RANK_COLOR[5];

        // ---- 움직임 ----
        if (phase === "idle") {
          b.x += b.vx * 2.2;
          b.y += b.vy * 2.2;
          if (b.x < STAGE_LEFT + b.radius || b.x > STAGE_RIGHT - b.radius) b.vx *= -1;
          if (b.y < STAGE_TOP + b.radius || b.y > STAGE_BOTTOM - b.radius) b.vy *= -1;
        } else if (phase === "accelerate") {
          b.x += b.vx * 4;
          b.y += b.vy * 4;
          if (b.x < STAGE_LEFT + b.radius || b.x > STAGE_RIGHT - b.radius) b.vx *= -1;
          if (b.y < STAGE_TOP + b.radius || b.y > STAGE_BOTTOM - b.radius) b.vy *= -1;
        } else if (phase === "converge") {
          const dx = centerX - b.x;
          const dy = centerY - b.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const pull = elapsed < 1500 ? 0.06 : -0.03; // 몰렸다가 흩어짐
          b.x += (dx / dist) * pull * dist * 0.02 + Math.sin(now / 200 + b.phaseOffset) * 2;
          b.y += (dy / dist) * pull * dist * 0.02 + Math.cos(now / 200 + b.phaseOffset) * 2;
        } else if (phase === "settle" || phase === "highlight") {
          b.x += b.vx * 0.6;
          b.y += b.vy * 0.6;
          if (b.x < STAGE_LEFT + b.radius || b.x > STAGE_RIGHT - b.radius) b.vx *= -1;
          if (b.y < STAGE_TOP + b.radius || b.y > STAGE_BOTTOM - b.radius) b.vy *= -1;
        } else if (phase === "reveal") {
          if (isSelected) {
            b.x += (centerX - b.x) * 0.12;
            b.y += (centerY - b.y) * 0.12;
          } else {
            b.opacity = Math.max(0, b.opacity - 0.04);
          }
        } else {
          // 평상시 Ambient Float
          b.x += b.vx * 0.5 + Math.sin(now / 1800 + b.phaseOffset) * 0.15;
          b.y += b.vy * 0.5 + Math.cos(now / 2200 + b.phaseOffset) * 0.15;
          if (b.x < STAGE_LEFT + b.radius || b.x > STAGE_RIGHT - b.radius) b.vx *= -1;
          if (b.y < STAGE_TOP + b.radius || b.y > STAGE_BOTTOM - b.radius) b.vy *= -1;
        }

        // ---- 렌더링 ----
        const glowPulse = 0.7 + 0.3 * Math.sin(now / 900 + b.phaseOffset);
        const drawRadius = isSelected && phase === "reveal" ? b.radius * 1.8 : b.radius;

        ctx.save();
        ctx.globalAlpha = b.opacity;

        const gradient = ctx.createRadialGradient(
          b.x,
          b.y,
          drawRadius * 0.15,
          b.x,
          b.y,
          drawRadius * (isSelected ? 1.6 : 1.15) * glowPulse
        );
        gradient.addColorStop(0, colors.core);
        gradient.addColorStop(0.55, colors.glow);
        gradient.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(b.x, b.y, drawRadius * (isSelected ? 1.6 : 1.15) * glowPulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = colors.core;
        ctx.beginPath();
        ctx.arc(b.x, b.y, drawRadius, 0, Math.PI * 2);
        ctx.fill();

        const fontSize = Math.max(14, Math.round(drawRadius * 0.85));
        ctx.font = `800 ${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(2, drawRadius * 0.12);
        ctx.strokeStyle = "rgba(4,8,20,0.85)";
        ctx.strokeText(String(b.rank), b.x, b.y);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(String(b.rank), b.x, b.y);

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      className="absolute left-0 top-0"
    />
  );
});
