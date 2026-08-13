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

// 추첨 연출: 하단 중앙의 "구멍"으로 당첨 구슬이 소용돌이치며 빨려 들어갔다가 튀어나온다.
const HOLE = { x: STAGE_CENTER.x, y: STAGE_BOTTOM - 50 };
const HOLE_RADIUS = 34;
const HOLD_POINT = { x: HOLE.x, y: HOLE.y - 90 };

// 충돌 시 과도한 에너지 누적을 막기 위한 속도 상한
const MAX_BALL_SPEED = 4.8;

const ACCEL_MS = 1800;
const VORTEX_MIN_MS = 1200;
const DROP_MS = 900;
const REVEAL_MS = 1300;
const POP_MS = 280;

const RANK_COLOR: Record<number, { core: string; glow: string }> = {
  1: { core: RANK_COLOR_HEX[1], glow: "rgba(255,255,255,0.9)" },
  2: { core: RANK_COLOR_HEX[2], glow: "rgba(49,231,255,0.85)" },
  3: { core: RANK_COLOR_HEX[3], glow: "rgba(76,140,255,0.8)" },
  4: { core: RANK_COLOR_HEX[4], glow: "rgba(123,140,255,0.6)" },
  5: { core: RANK_COLOR_HEX[5], glow: "rgba(93,107,140,0.5)" },
};

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.min(1, Math.max(0, t));
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
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
  // vortex 단계에서만 사용하는 원형 궤도 파라미터 (물리 시뮬레이션이 아닌
  // 순수 함수형 좌표 계산이라 매 프레임 항상 매끄러운 원을 그린다)
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
}

function orbitMaxRadius(ballRadius: number) {
  return (
    Math.min(
      STAGE_CENTER.x - STAGE_LEFT,
      STAGE_RIGHT - STAGE_CENTER.x,
      STAGE_CENTER.y - STAGE_TOP,
      STAGE_BOTTOM - STAGE_CENTER.y
    ) -
    ballRadius -
    12
  );
}

// idle: 평상시 부유 / accelerate: 추첨 시작, 빠르게 휘저음 / vortex: 소용돌이치듯 회전
// drop: 당첨 구슬이 회전하며 하단 구멍으로 빨려 들어감 / reveal: 구멍에서 튀어나와 중앙에 전시
type Phase = "idle" | "accelerate" | "vortex" | "drop" | "reveal";

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

  const dropTargetIdRef = useRef<string | null>(null);
  const holdPosRef = useRef({ ...HOLE });

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
            orbitRadius: 0,
            orbitAngle: 0,
            orbitSpeed: 0,
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
      dropTargetIdRef.current = null;
      holdPosRef.current = { ...HOLE };
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

    function drawHole(now: number, active: boolean) {
      const pulse = active ? 0.5 + 0.5 * Math.sin(now / 140) : 0.35 + 0.15 * Math.sin(now / 900);
      ctx.save();
      const gradient = ctx.createRadialGradient(
        HOLE.x,
        HOLE.y,
        2,
        HOLE.x,
        HOLE.y,
        HOLE_RADIUS * (active ? 2.4 : 1.8)
      );
      gradient.addColorStop(0, `rgba(49,231,255,${0.45 + pulse * 0.3})`);
      gradient.addColorStop(0.55, "rgba(49,231,255,0.12)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(HOLE.x, HOLE.y, HOLE_RADIUS * (active ? 2.4 : 1.8), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(4,7,18,0.95)";
      ctx.beginPath();
      ctx.ellipse(HOLE.x, HOLE.y, HOLE_RADIUS, HOLE_RADIUS * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(49,231,255,${0.6 + pulse * 0.3})`;
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

    function tick(now: number) {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawStageFrame();
      const balls = ballsRef.current;
      const phase = phaseRef.current;
      const elapsed = now - phaseStartRef.current;
      drawHole(now, phase === "drop" || phase === "reveal");

      // ---- Phase 전환 로직 ----
      if (phase === "accelerate" && elapsed > ACCEL_MS) {
        // 각 구슬을 현재 위치에서 이어지는 원형 궤도로 자연스럽게 편입시킨다.
        for (const b of balls) {
          const dx = b.x - STAGE_CENTER.x;
          const dy = b.y - STAGE_CENTER.y;
          const rawRadius = Math.hypot(dx, dy) || 1;
          b.orbitRadius = Math.min(rawRadius, Math.max(24, orbitMaxRadius(b.radius)));
          b.orbitAngle = Math.atan2(dy, dx);
          b.orbitSpeed = 0.045 + Math.random() * 0.025;
        }
        phaseRef.current = "vortex";
        phaseStartRef.current = now;
      } else if (phase === "vortex") {
        if (!dropTargetIdRef.current && winningRankRef.current !== null && elapsed > VORTEX_MIN_MS) {
          const chosen = pickSelectedBall();
          if (chosen) {
            chosen.selected = true;
            selectedBallIdRef.current = chosen.id;
            dropTargetIdRef.current = chosen.id;
            phaseRef.current = "drop";
            phaseStartRef.current = now;
          }
        }
      } else if (phase === "drop") {
        const target = balls.find((b) => b.id === dropTargetIdRef.current);
        const dist = target ? Math.hypot(HOLE.x - target.x, HOLE.y - target.y) : 0;
        if (elapsed > DROP_MS || dist < 16) {
          if (winningRankRef.current !== null) {
            onRevealReady(winningRankRef.current);
          }
          holdPosRef.current = { ...HOLE };
          phaseRef.current = "reveal";
          phaseStartRef.current = now;
        }
      } else if (phase === "reveal" && elapsed > REVEAL_MS) {
        const releasedId = dropTargetIdRef.current;
        const released = balls.find((b) => b.id === releasedId);
        if (released) {
          released.x = HOLE.x;
          released.y = HOLE.y - 20;
          released.vx = (Math.random() - 0.5) * 2.7;
          released.vy = -1.5 - Math.random();
        }
        for (const b of balls) {
          b.opacity = 1;
          b.selected = false;
        }
        dropTargetIdRef.current = null;
        selectedBallIdRef.current = null;
        phaseRef.current = "idle";
        phaseStartRef.current = now;
      }

      // ---- 구슬 이동 ----
      // idle/accelerate: 기존처럼 속도+충돌 물리 시뮬레이션을 사용한다.
      // vortex/drop/reveal: 힘을 누적시키는 물리 대신, 시간에 대한 순수 함수로 좌표를
      // 직접 계산한다. 그래야 충돌·클램프 등 여러 힘이 겹쳐서 생기는 뚝뚝 끊기거나
      // 갑자기 방향이 튀는 부자연스러운 움직임 없이 항상 매끄러운 곡선을 그린다.
      if (phase === "idle" || phase === "accelerate") {
        const mult = phase === "idle" ? 2.2 : 8;
        for (const b of balls) {
          b.x += b.vx * mult;
          b.y += b.vy * mult;
          clampToStage(b);
        }
        resolveCollisions(balls);
        for (const b of balls) clampSpeed(b);
      } else if (phase === "vortex") {
        for (const b of balls) {
          b.orbitAngle += b.orbitSpeed;
          b.x = STAGE_CENTER.x + b.orbitRadius * Math.cos(b.orbitAngle);
          b.y = STAGE_CENTER.y + b.orbitRadius * Math.sin(b.orbitAngle);
        }
      } else if (phase === "drop") {
        const t = Math.min(1, elapsed / DROP_MS);
        const te = t * t; // ease-in: 갈수록 빠르게 빨려들어간다
        const originX = STAGE_CENTER.x + (HOLE.x - STAGE_CENTER.x) * te;
        const originY = STAGE_CENTER.y + (HOLE.y - STAGE_CENTER.y) * te;
        for (const b of balls) {
          if (b.id === dropTargetIdRef.current) {
            b.orbitAngle += b.orbitSpeed * (1 + te * 4);
            const r = b.orbitRadius * (1 - te);
            b.x = originX + r * Math.cos(b.orbitAngle);
            b.y = originY + r * Math.sin(b.orbitAngle);
            b.opacity = elapsed > DROP_MS - 150 ? Math.max(0, 1 - (elapsed - (DROP_MS - 150)) / 150) : 1;
          } else {
            b.orbitAngle += b.orbitSpeed;
            b.x = STAGE_CENTER.x + b.orbitRadius * Math.cos(b.orbitAngle);
            b.y = STAGE_CENTER.y + b.orbitRadius * Math.sin(b.orbitAngle);
            b.opacity = Math.max(0.25, b.opacity - 0.02);
          }
        }
      } else if (phase === "reveal") {
        for (const b of balls) {
          if (b.id === dropTargetIdRef.current) {
            holdPosRef.current.x += (HOLD_POINT.x - holdPosRef.current.x) * 0.07;
            holdPosRef.current.y += (HOLD_POINT.y - holdPosRef.current.y) * 0.07;
            b.x = holdPosRef.current.x;
            b.y = holdPosRef.current.y;
            b.opacity = Math.min(1, elapsed / 120);
          } else {
            b.orbitAngle += b.orbitSpeed;
            b.x = STAGE_CENTER.x + b.orbitRadius * Math.cos(b.orbitAngle);
            b.y = STAGE_CENTER.y + b.orbitRadius * Math.sin(b.orbitAngle);
            b.opacity = Math.max(0.18, b.opacity - 0.02);
          }
        }
      }

      // ---- 렌더링 ----
      for (const b of balls) {
        const isSelected = b.id === selectedBallIdRef.current;
        const colors = RANK_COLOR[b.rank] ?? RANK_COLOR[5];
        const glowPulse = 0.7 + 0.3 * Math.sin(now / 900 + b.phaseOffset);

        let drawRadius = b.radius;
        if (isSelected && phase === "reveal") {
          const popT = easeOutBack(elapsed / POP_MS);
          drawRadius = b.radius * 1.7 * Math.max(0.05, popT);
        }

        if (drawRadius <= 0.5) continue;

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
        // lineJoin이 기본값(miter)이면 숫자의 뾰족한 모서리(2, 4 등)에서
        // 뿔처럼 튀어나오는 얼룩이 생긴다. round로 바꾸고 선도 얇게 줄인다.
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.lineWidth = Math.max(1.5, drawRadius * 0.055);
        ctx.strokeStyle = "rgba(4,8,20,0.75)";
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
