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

// 로봇팔 연출: 마운트 위치(상자 상단 중앙)와, 당첨구슬을 들어올려 보여주는 지점
const ARM_BASE = { x: (STAGE_LEFT + STAGE_RIGHT) / 2, y: STAGE_TOP - 30 };
const PRESENT_POINT = { x: (STAGE_LEFT + STAGE_RIGHT) / 2, y: (STAGE_TOP + STAGE_BOTTOM) / 2 - 90 };

const ACCEL_MS = 2000;
const GRAB_MS = 550;
const REVEAL_MS = 1300;

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

// idle: 평상시 부유 / accelerate: 추첨 시작, 2배속으로 휘저음 / seek: 로봇팔이 당첨 구슬을 찾아 접근
// grab: 집게로 포착 / reveal: 들어올려 중앙에 전시 (이후 idle로 복귀)
type Phase = "idle" | "accelerate" | "seek" | "grab" | "reveal";

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

  // 로봇팔 상태
  const armHeadPosRef = useRef({ ...ARM_BASE });
  const armAlphaRef = useRef(0);
  const clawOpenRef = useRef(1);
  const armTargetIdRef = useRef<string | null>(null);
  const armPickedAtRef = useRef(0);

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
      armTargetIdRef.current = null;
      armHeadPosRef.current = { ...ARM_BASE };
      armAlphaRef.current = 0;
      clawOpenRef.current = 1;
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

      for (const ball of balls) {
        const speed = Math.hypot(ball.vx, ball.vy);
        if (speed > MAX_BALL_SPEED) {
          ball.vx = (ball.vx / speed) * MAX_BALL_SPEED;
          ball.vy = (ball.vy / speed) * MAX_BALL_SPEED;
        }
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

    function drawArm() {
      const alpha = armAlphaRef.current;
      if (alpha < 0.02) return;
      const head = armHeadPosRef.current;
      const base = ARM_BASE;
      const openT = clawOpenRef.current;

      ctx.save();
      ctx.globalAlpha = alpha;

      const midX = (base.x + head.x) / 2 + (head.y - base.y) * 0.08;
      const midY = (base.y + head.y) / 2 - (head.x - base.x) * 0.08;

      ctx.strokeStyle = "rgba(120,170,255,0.9)";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.quadraticCurveTo(midX, midY, head.x, head.y);
      ctx.stroke();

      ctx.strokeStyle = "rgba(49,231,255,0.9)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.quadraticCurveTo(midX, midY, head.x, head.y);
      ctx.stroke();

      ctx.fillStyle = "rgba(20,30,60,0.95)";
      ctx.beginPath();
      ctx.arc(base.x, base.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(49,231,255,0.7)";
      ctx.lineWidth = 3;
      ctx.stroke();

      const angle = Math.atan2(head.y - base.y, head.x - base.x);
      const spread = 0.3 + openT * 0.55;
      const fingerLen = 34;
      for (const dir of [-1, 1]) {
        const a = angle + dir * spread;
        ctx.strokeStyle = "rgba(230,240,255,0.95)";
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        ctx.quadraticCurveTo(
          head.x + Math.cos(a) * fingerLen * 0.55,
          head.y + Math.sin(a) * fingerLen * 0.55,
          head.x + Math.cos(a - dir * 0.45) * fingerLen,
          head.y + Math.sin(a - dir * 0.45) * fingerLen
        );
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(230,240,255,0.95)";
      ctx.beginPath();
      ctx.arc(head.x, head.y, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function drawGrabFlash(elapsed: number) {
      const t = Math.min(1, elapsed / 350);
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(armHeadPosRef.current.x, armHeadPosRef.current.y, 20 + t * 90, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function tick(now: number) {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawStageFrame();
      const balls = ballsRef.current;
      const phase = phaseRef.current;
      const elapsed = now - phaseStartRef.current;

      // ---- Phase 전환 로직 ----
      if (phase === "accelerate" && elapsed > ACCEL_MS) {
        phaseRef.current = "seek";
        phaseStartRef.current = now;
      } else if (phase === "seek") {
        if (!armTargetIdRef.current && winningRankRef.current !== null) {
          const chosen = pickSelectedBall();
          if (chosen) {
            chosen.selected = true;
            selectedBallIdRef.current = chosen.id;
            armTargetIdRef.current = chosen.id;
            armPickedAtRef.current = now;
          }
        }
        if (armTargetIdRef.current) {
          const target = balls.find((b) => b.id === armTargetIdRef.current);
          const dist = target
            ? Math.hypot(armHeadPosRef.current.x - target.x, armHeadPosRef.current.y - target.y)
            : 0;
          if (dist < 36 || now - armPickedAtRef.current > 2500) {
            phaseRef.current = "grab";
            phaseStartRef.current = now;
          }
        }
      } else if (phase === "grab" && elapsed > GRAB_MS) {
        if (winningRankRef.current !== null) {
          onRevealReady(winningRankRef.current);
        }
        phaseRef.current = "reveal";
        phaseStartRef.current = now;
      } else if (phase === "reveal" && elapsed > REVEAL_MS) {
        const releasedId = armTargetIdRef.current;
        const released = balls.find((b) => b.id === releasedId);
        if (released) {
          released.vx = (Math.random() - 0.5) * 2.7;
          released.vy = (Math.random() - 0.5) * 2.7;
        }
        for (const b of balls) {
          b.opacity = 1;
          b.selected = false;
        }
        armTargetIdRef.current = null;
        selectedBallIdRef.current = null;
        armHeadPosRef.current = { ...ARM_BASE };
        phaseRef.current = "idle";
        phaseStartRef.current = now;
      }

      // ---- 구슬 이동 ----
      for (const b of balls) {
        const isTarget = b.id === armTargetIdRef.current;

        if (phase === "idle") {
          b.x += b.vx * 2.2;
          b.y += b.vy * 2.2;
        } else if (phase === "accelerate") {
          b.x += b.vx * 8;
          b.y += b.vy * 8;
        } else if (phase === "seek") {
          b.x += b.vx * 0.6;
          b.y += b.vy * 0.6;
        } else if (phase === "grab" || phase === "reveal") {
          if (isTarget) {
            b.x = armHeadPosRef.current.x;
            b.y = armHeadPosRef.current.y;
          } else {
            b.x += b.vx * 0.4;
            b.y += b.vy * 0.4;
            b.opacity = Math.max(0.18, b.opacity - 0.03);
          }
        }

        if (!isTarget) clampToStage(b);
      }

      // ---- 로봇팔 갱신 ----
      const targetAlpha = phase === "seek" || phase === "grab" || phase === "reveal" ? 1 : 0;
      armAlphaRef.current += (targetAlpha - armAlphaRef.current) * 0.12;

      if (phase === "seek") {
        let aimX: number;
        let aimY: number;
        if (armTargetIdRef.current) {
          const target = balls.find((b) => b.id === armTargetIdRef.current);
          aimX = target ? target.x : ARM_BASE.x;
          aimY = target ? target.y : ARM_BASE.y;
        } else {
          aimX = PRESENT_POINT.x + Math.cos(now / 450) * 150;
          aimY = PRESENT_POINT.y + 90 + Math.sin(now / 450) * 90;
        }
        armHeadPosRef.current.x += (aimX - armHeadPosRef.current.x) * 0.07;
        armHeadPosRef.current.y += (aimY - armHeadPosRef.current.y) * 0.07;
      } else if (phase === "reveal") {
        armHeadPosRef.current.x += (PRESENT_POINT.x - armHeadPosRef.current.x) * 0.06;
        armHeadPosRef.current.y += (PRESENT_POINT.y - armHeadPosRef.current.y) * 0.06;
      }

      const targetClawOpen = phase === "grab" || phase === "reveal" ? 0 : 1;
      clawOpenRef.current += (targetClawOpen - clawOpenRef.current) * 0.15;

      // ---- 충돌 처리 (포획된 당첨 구슬은 제외) ----
      if (phase === "grab" || phase === "reveal") {
        resolveCollisions(balls.filter((b) => b.id !== armTargetIdRef.current));
      } else {
        resolveCollisions(balls);
      }
      for (const b of balls) {
        if (b.id !== armTargetIdRef.current) clampToStage(b);
      }

      // ---- 렌더링 ----
      for (const b of balls) {
        const isSelected = b.id === selectedBallIdRef.current;
        const colors = RANK_COLOR[b.rank] ?? RANK_COLOR[5];
        const glowPulse = 0.7 + 0.3 * Math.sin(now / 900 + b.phaseOffset);
        const drawRadius =
          isSelected && (phase === "grab" || phase === "reveal") ? b.radius * 1.7 : b.radius;

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

      if (phase === "grab") {
        drawGrabFlash(elapsed);
      }
      drawArm();

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
