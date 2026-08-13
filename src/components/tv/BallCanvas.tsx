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
const STAGE_CENTER = { x: (STAGE_LEFT + STAGE_RIGHT) / 2, y: (STAGE_TOP + STAGE_BOTTOM) / 2 };

// 중앙에서 구슬이 부풀어 오를 때 상자 벽에 닿지 않도록 확보된 여유 공간
const CENTER_CLEARANCE =
  Math.min(
    STAGE_CENTER.x - STAGE_LEFT,
    STAGE_RIGHT - STAGE_CENTER.x,
    STAGE_CENTER.y - STAGE_TOP,
    STAGE_BOTTOM - STAGE_CENTER.y
  ) - 16;

// 충돌 시 과도한 에너지 누적을 막기 위한 속도 상한
const MAX_BALL_SPEED = 4.8;

const SHUFFLE_MULT = 4.4; // idle(2.2)의 약 2배
const SHUFFLE_MIN_MS = 1500;
const GROW_MS = 900;
const POP_MS = 350;
const MAX_GROW_SCALE = 3.2;

const RANK_COLOR: Record<number, { core: string; glow: string }> = {
  1: { core: RANK_COLOR_HEX[1], glow: "rgba(255,255,255,0.9)" },
  2: { core: RANK_COLOR_HEX[2], glow: "rgba(49,231,255,0.85)" },
  3: { core: RANK_COLOR_HEX[3], glow: "rgba(76,140,255,0.8)" },
  4: { core: RANK_COLOR_HEX[4], glow: "rgba(123,140,255,0.6)" },
  5: { core: RANK_COLOR_HEX[5], glow: "rgba(93,107,140,0.5)" },
};

function growScaleAt(t: number, ballRadius: number) {
  const growT = Math.pow(Math.min(1, Math.max(0, t)), 1.6);
  const desired = 1 + growT * (MAX_GROW_SCALE - 1);
  const maxForBall = Math.max(1, CENTER_CLEARANCE / ballRadius);
  return Math.min(desired, maxForBall, MAX_GROW_SCALE);
}

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

// idle: 평상시 부유 / shuffle: 응모 클릭, 전체가 2배속으로 빠르게 움직임
// grow: 당첨 구슬만 중앙에서 멈춰 점점 부풀어 오름(다른 구슬은 계속 빠르게 움직임)
// pop: 부풀어 오른 구슬이 터지며 당첨화면으로 전환
type Phase = "idle" | "shuffle" | "grow" | "pop";

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
  const targetIdRef = useRef<string | null>(null);
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
      phaseRef.current = "shuffle";
      phaseStartRef.current = performance.now();
      winningRankRef.current = null;
      selectedBallIdRef.current = null;
      targetIdRef.current = null;
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
    }

    // 성장 중인 당첨 구슬은 움직이지 않는 장애물로 취급해, 다른 구슬들이 튕겨나가게 한다.
    function resolveObstacle(moving: Ball[], ox: number, oy: number, obstacleRadius: number) {
      for (const b of moving) {
        const dx = b.x - ox;
        const dy = b.y - oy;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const minDist = obstacleRadius + b.radius;
        if (dist >= minDist) continue;

        const nx = dx / dist;
        const ny = dy / dist;
        b.x = ox + nx * minDist;
        b.y = oy + ny * minDist;

        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) {
          b.vx -= 2 * dot * nx;
          b.vy -= 2 * dot * ny;
        }
      }
    }

    function clampSpeed(b: Ball) {
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > MAX_BALL_SPEED) {
        b.vx = (b.vx / speed) * MAX_BALL_SPEED;
        b.vy = (b.vy / speed) * MAX_BALL_SPEED;
      }
    }

    // 어떤 이유로든(충돌 밀림 등) 구슬이 상자 밖으로 나가지 않도록 매 프레임 강제로 가둔다.
    function clampToStage(b: Ball) {
      if (b.x < STAGE_LEFT + b.radius) {
        b.x = STAGE_LEFT + b.radius;
        if (b.vx < 0) b.vx *= -1;
      } else if (b.x > STAGE_RIGHT - b.radius) {
        b.x = STAGE_RIGHT - b.radius;
        if (b.vx > 0) b.vx *= -1;
      }
      if (b.y < STAGE_TOP + b.radius) {
        b.y = STAGE_TOP + b.radius;
        if (b.vy < 0) b.vy *= -1;
      } else if (b.y > STAGE_BOTTOM - b.radius) {
        b.y = STAGE_BOTTOM - b.radius;
        if (b.vy > 0) b.vy *= -1;
      }
    }

    function drawBurst(x: number, y: number, baseRadius: number, t: number) {
      const ringT = Math.min(1, t);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - ringT) * 0.9;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, y, baseRadius * (1 + ringT * 1.8), 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = Math.max(0, 1 - ringT * 1.4) * 0.55;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(x, y, baseRadius * Math.max(0, 1 - ringT * 0.7), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function tick(now: number) {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawStageFrame();
      const balls = ballsRef.current;
      const phase = phaseRef.current;
      const elapsed = now - phaseStartRef.current;

      // ---- Phase 전환 로직 ----
      if (phase === "shuffle") {
        if (!targetIdRef.current && winningRankRef.current !== null && elapsed > SHUFFLE_MIN_MS) {
          const chosen = pickSelectedBall();
          if (chosen) {
            chosen.selected = true;
            selectedBallIdRef.current = chosen.id;
            targetIdRef.current = chosen.id;
            phaseRef.current = "grow";
            phaseStartRef.current = now;
          }
        }
      } else if (phase === "grow" && elapsed > GROW_MS) {
        if (winningRankRef.current !== null) {
          onRevealReady(winningRankRef.current);
        }
        phaseRef.current = "pop";
        phaseStartRef.current = now;
      } else if (phase === "pop" && elapsed > POP_MS) {
        const releasedId = targetIdRef.current;
        const released = balls.find((b) => b.id === releasedId);
        if (released) {
          released.x = STAGE_CENTER.x;
          released.y = STAGE_CENTER.y;
          released.vx = (Math.random() - 0.5) * 2.7;
          released.vy = (Math.random() - 0.5) * 2.7;
        }
        for (const b of balls) {
          b.opacity = 1;
          b.selected = false;
        }
        targetIdRef.current = null;
        selectedBallIdRef.current = null;
        phaseRef.current = "idle";
        phaseStartRef.current = now;
      }

      // ---- 구슬 이동 ----
      if (phase === "idle" || phase === "shuffle") {
        const mult = phase === "idle" ? 2.2 : SHUFFLE_MULT;
        for (const b of balls) {
          b.x += b.vx * mult;
          b.y += b.vy * mult;
          clampToStage(b);
        }
        resolveCollisions(balls);
        for (const b of balls) clampSpeed(b);
      } else if (phase === "grow") {
        const target = balls.find((b) => b.id === targetIdRef.current);
        const others = balls.filter((b) => b.id !== targetIdRef.current);

        if (target) {
          target.x += (STAGE_CENTER.x - target.x) * 0.08;
          target.y += (STAGE_CENTER.y - target.y) * 0.08;
        }
        for (const b of others) {
          b.x += b.vx * SHUFFLE_MULT;
          b.y += b.vy * SHUFFLE_MULT;
          clampToStage(b);
        }
        resolveCollisions(others);
        for (const b of others) clampSpeed(b);

        if (target) {
          const scale = growScaleAt(elapsed / GROW_MS, target.radius);
          resolveObstacle(others, target.x, target.y, target.radius * scale);
        }
      } else if (phase === "pop") {
        const others = balls.filter((b) => b.id !== targetIdRef.current);
        for (const b of others) {
          b.x += b.vx * 2.2;
          b.y += b.vy * 2.2;
          clampToStage(b);
        }
        resolveCollisions(others);
        for (const b of others) clampSpeed(b);
      }

      // ---- 렌더링 ----
      for (const b of balls) {
        const isSelected = b.id === selectedBallIdRef.current;
        if (isSelected && phase === "pop") continue; // 터지는 연출은 아래에서 별도로 그린다.

        const colors = RANK_COLOR[b.rank] ?? RANK_COLOR[5];
        const glowPulse = 0.7 + 0.3 * Math.sin(now / 900 + b.phaseOffset);

        let drawRadius = b.radius;
        if (isSelected && phase === "grow") {
          drawRadius = b.radius * growScaleAt(elapsed / GROW_MS, b.radius);
        }

        ctx.save();
        ctx.globalAlpha = b.opacity;

        const gradient = ctx.createRadialGradient(
          b.x,
          b.y,
          drawRadius * 0.15,
          b.x,
          b.y,
          drawRadius * (isSelected ? 1.4 : 1.15) * glowPulse
        );
        gradient.addColorStop(0, colors.core);
        gradient.addColorStop(0.55, colors.glow);
        gradient.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(b.x, b.y, drawRadius * (isSelected ? 1.4 : 1.15) * glowPulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = colors.core;
        ctx.beginPath();
        ctx.arc(b.x, b.y, drawRadius, 0, Math.PI * 2);
        ctx.fill();

        const fontSize = Math.max(14, Math.round(drawRadius * 0.85));
        ctx.font = `800 ${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.lineWidth = Math.max(1.5, drawRadius * 0.055);
        ctx.strokeStyle = "rgba(4,8,20,0.75)";
        ctx.strokeText(String(b.rank), b.x, b.y);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(String(b.rank), b.x, b.y);

        ctx.restore();
      }

      if (phase === "pop") {
        const target = balls.find((b) => b.id === targetIdRef.current);
        if (target) {
          const finalScale = growScaleAt(1, target.radius);
          drawBurst(target.x, target.y, target.radius * finalScale, elapsed / POP_MS);
        }
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
