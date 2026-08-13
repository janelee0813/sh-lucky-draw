"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { BALL_SIZE, RANK_COLOR_HEX, VISUAL_BALL_COUNT } from "@/lib/config/settings";
import type { PublicPrizeStatus } from "@/types/database";

const CANVAS_WIDTH = 1480;
const CANVAS_HEIGHT = 1080;

// 구슬이 떠다니는 영역을 라운드 사각형으로 한정한다 (로고/타이틀이 한 줄로 축소되어 상단 여백이 줄었다).
const STAGE_LEFT = 56;
const STAGE_TOP = 150;
const STAGE_RIGHT = CANVAS_WIDTH - 56;
const STAGE_BOTTOM = CANVAS_HEIGHT - 56;
const STAGE_CORNER_RADIUS = 40;

// 충돌 시 과도한 에너지 누적을 막기 위한 속도 상한
const MAX_BALL_SPEED = 4.8;

const RANK_COLOR: Record<number, { core: string; glow: string }> = {
  1: { core: RANK_COLOR_HEX[1], glow: "rgba(255,255,255,0.9)" },
  2: { core: RANK_COLOR_HEX[2], glow: "rgba(49,231,255,0.85)" },
  3: { core: RANK_COLOR_HEX[3], glow: "rgba(76,140,255,0.8)" },
  4: { core: RANK_COLOR_HEX[4], glow: "rgba(123,140,255,0.6)" },
  5: { core: RANK_COLOR_HEX[5], glow: "rgba(93,107,140,0.5)" },
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
            vx: (Math.random() - 0.5) * 2.7,
            vy: (Math.random() - 0.5) * 2.7,
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

    // 구슬끼리 겹치면 밀어내고 속도를 반사시켜 실제로 부딪히는 느낌을 준다.
    function resolveCollisions(balls: Ball[]) {
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minDist = a.radius + b.radius;
          if (dist >= minDist) continue;

          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          const totalRadius = a.radius + b.radius;
          a.x -= nx * overlap * (b.radius / totalRadius);
          a.y -= ny * overlap * (b.radius / totalRadius);
          b.x += nx * overlap * (a.radius / totalRadius);
          b.y += ny * overlap * (a.radius / totalRadius);

          const relVx = b.vx - a.vx;
          const relVy = b.vy - a.vy;
          const relDot = relVx * nx + relVy * ny;
          if (relDot >= 0) continue; // 이미 서로 멀어지는 중이면 반사하지 않는다.

          const massA = a.radius * a.radius;
          const massB = b.radius * b.radius;
          const impulse = (2 * relDot) / (massA + massB);
          a.vx += impulse * massB * nx;
          a.vy += impulse * massB * ny;
          b.vx -= impulse * massA * nx;
          b.vy -= impulse * massA * ny;
        }
      }

      for (const ball of balls) {
        const speed = Math.hypot(ball.vx, ball.vy);
        if (speed > MAX_BALL_SPEED) {
          ball.vx = (ball.vx / speed) * MAX_BALL_SPEED;
          ball.vy = (ball.vy / speed) * MAX_BALL_SPEED;
        }
      }
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
      }

      // ---- 충돌 처리 (reveal 연출 중에는 당첨 구슬의 이동을 방해하지 않도록 제외) ----
      if (phase !== "reveal") {
        resolveCollisions(balls);
      }

      for (const b of balls) {
        const isSelected = b.id === selectedBallIdRef.current;
        const colors = RANK_COLOR[b.rank] ?? RANK_COLOR[5];

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
