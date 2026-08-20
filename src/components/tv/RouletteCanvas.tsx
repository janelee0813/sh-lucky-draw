"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { RANK_COLOR_HEX } from "@/lib/config/settings";
import type { PublicPrizeStatus } from "@/types/database";

const CANVAS_WIDTH = 1320;
const CANVAS_HEIGHT = 1080;

// BallCanvas와 동일한 상자 영역을 공유해, 전환 버튼을 눌러도 무대 프레임이 그대로 유지된다.
const STAGE_LEFT = 56;
const STAGE_TOP = 150;
const STAGE_RIGHT = CANVAS_WIDTH - 56;
const STAGE_BOTTOM = CANVAS_HEIGHT - 56;
const STAGE_CORNER_RADIUS = 40;
const STAGE_CENTER = { x: (STAGE_LEFT + STAGE_RIGHT) / 2, y: (STAGE_TOP + STAGE_BOTTOM) / 2 };

const WHEEL_RADIUS =
  Math.min(STAGE_RIGHT - STAGE_LEFT, STAGE_BOTTOM - STAGE_TOP) / 2 - 70;
const HUB_RADIUS = WHEEL_RADIUS * 0.17;

const SPIN_SOUND_SRC = "/sounds/roulette.wav";
const SPIN_SOUND_GAIN = 2; // 기본 볼륨(최대 1.0)의 2배로 증폭

const RANKS = [1, 2, 3, 4, 5] as const;
const SLICE_ANGLE = (Math.PI * 2) / RANKS.length;
// 0번 슬라이스 중심이 정확히 12시 방향(포인터 위치)에 오도록 하는 기준 시작각
const SLICE_BASE_START = -Math.PI / 2 - SLICE_ANGLE / 2;

const IDLE_SPEED = 0.0035; // rad/frame, 대기 중 은은한 회전
const SPIN_TARGET_SPEED = 0.34; // rad/frame, 추첨 중 빠른 회전
const MS_PER_FRAME = 1000 / 60;
const SPIN_MIN_MS = 4000;
const SETTLE_MS = 5000;
const FLASH_MS = 800;
const EXTRA_TURNS = 8; // 감속 구간에서 도는 추가 바퀴 수 - 늘릴수록 급정지 없이 천천히 멈추는 느낌이 된다.
// 전체 연출 길이(가속 대기 없이) = SPIN_MIN_MS + SETTLE_MS + FLASH_MS ≈ 9.8초 (BallCanvas와 유사)

const RANK_COLOR: Record<number, { core: string; glow: string }> = {
  1: { core: RANK_COLOR_HEX[1], glow: "rgba(255,255,255,0.9)" },
  2: { core: RANK_COLOR_HEX[2], glow: "rgba(49,231,255,0.85)" },
  3: { core: RANK_COLOR_HEX[3], glow: "rgba(76,140,255,0.8)" },
  4: { core: RANK_COLOR_HEX[4], glow: "rgba(123,140,255,0.6)" },
  5: { core: RANK_COLOR_HEX[5], glow: "rgba(93,107,140,0.5)" },
};

// Hermite 보간: 시작 속도(m0)를 감속 직전 회전 속도와 정확히 이어지도록 맞추고,
// 끝에서는 속도가 0이 되도록 부드럽게 감속시킨다. 이렇게 하면 빠르게 돌다가
// 갑자기 브레이크를 거는 느낌 없이, 실제 속도 그대로 이어받아 서서히 멈춘다.
function easeFromVelocity(t: number, m0: number) {
  const c = Math.min(1, Math.max(0, t));
  const t2 = c * c;
  const t3 = t2 * c;
  const h10 = t3 - 2 * t2 + c;
  const h01 = -2 * t3 + 3 * t2;
  return h10 * m0 + h01;
}

function normalizeAngle(a: number) {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

// idle: 은은하게 계속 회전 / spin: 응모 클릭, 당첨 결과를 기다리며 고속 회전
// settle: 결과가 정해지면 목표 슬라이스에 정확히 멈출 때까지 감속 / flash: 멈춘 자리에서 터짐 연출
type Phase = "idle" | "spin" | "settle" | "flash";

export type RouletteCanvasHandle = {
  startDraw: (getWinningRank: () => Promise<number | null>) => void;
};

export const RouletteCanvas = forwardRef<
  RouletteCanvasHandle,
  {
    prizes: PublicPrizeStatus[];
    onRevealReady: (rank: number) => void;
  }
>(function RouletteCanvas({ prizes, onRevealReady }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prizesRef = useRef<PublicPrizeStatus[]>(prizes);
  const angleRef = useRef(0);
  const velocityRef = useRef(IDLE_SPEED);
  const phaseRef = useRef<Phase>("idle");
  const phaseStartRef = useRef(0);
  const settleFromRef = useRef(0);
  const settleToRef = useRef(0);
  const winningRankRef = useRef<number | null>(null);
  const landedRankRef = useRef<number | null>(null);
  const settleM0Ref = useRef(1);
  const rafRef = useRef<number>(0);
  const spinSoundRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    prizesRef.current = prizes;
  }, [prizes]);

  useEffect(() => {
    const audio = new Audio(SPIN_SOUND_SRC);
    spinSoundRef.current = audio;

    // HTMLAudioElement.volume은 최대 1.0(100%)까지만 지원하므로,
    // Web Audio API의 GainNode로 그 이상 증폭한다.
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaElementSource(audio);
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = SPIN_SOUND_GAIN;
      source.connect(gainNode).connect(audioCtx.destination);
      audioCtxRef.current = audioCtx;
    }

    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    startDraw(getWinningRank: () => Promise<number | null>) {
      phaseRef.current = "spin";
      phaseStartRef.current = performance.now();
      winningRankRef.current = null;
      landedRankRef.current = null;

      const sound = spinSoundRef.current;
      if (sound) {
        if (audioCtxRef.current?.state === "suspended") {
          audioCtxRef.current.resume().catch(() => {});
        }
        sound.currentTime = 0;
        sound.play().catch(() => {});
      }

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

      const phase = phaseRef.current;
      const elapsed = now - phaseStartRef.current;

      // ---- Phase 전환 로직 ----
      if (phase === "spin" && winningRankRef.current !== null && elapsed > SPIN_MIN_MS) {
        const rank = winningRankRef.current;
        const index = RANKS.indexOf(rank as (typeof RANKS)[number]);
        const currentMod = normalizeAngle(angleRef.current);
        const desiredMod = normalizeAngle(-index * SLICE_ANGLE);
        let delta = desiredMod - currentMod;
        if (delta <= 0.0001) delta += Math.PI * 2;

        const distance = delta + EXTRA_TURNS * Math.PI * 2;
        settleFromRef.current = angleRef.current;
        settleToRef.current = angleRef.current + distance;
        // 감속 시작 순간의 실제 회전 속도를 그대로 이어받도록 곡선의 시작 기울기를 맞춘다.
        const v0PerMs = velocityRef.current / MS_PER_FRAME;
        settleM0Ref.current = Math.min(2.4, (v0PerMs * SETTLE_MS) / distance);
        landedRankRef.current = rank;
        phaseRef.current = "settle";
        phaseStartRef.current = now;
      } else if (phase === "settle" && elapsed > SETTLE_MS) {
        angleRef.current = settleToRef.current;
        velocityRef.current = 0;
        if (landedRankRef.current !== null) onRevealReady(landedRankRef.current);
        phaseRef.current = "flash";
        phaseStartRef.current = now;
      } else if (phase === "flash" && elapsed > FLASH_MS) {
        landedRankRef.current = null;
        winningRankRef.current = null;
        phaseRef.current = "idle";
        phaseStartRef.current = now;
      }

      // ---- 회전각 갱신 ----
      if (phase === "idle") {
        velocityRef.current += (IDLE_SPEED - velocityRef.current) * 0.02;
        angleRef.current += velocityRef.current;
      } else if (phase === "spin") {
        velocityRef.current += (SPIN_TARGET_SPEED - velocityRef.current) * 0.05;
        angleRef.current += velocityRef.current;
      } else if (phase === "settle") {
        const t = easeFromVelocity(elapsed / SETTLE_MS, settleM0Ref.current);
        angleRef.current = settleFromRef.current + (settleToRef.current - settleFromRef.current) * t;
      }
      // flash 단계는 angleRef를 settleToRef에 고정한 채 유지한다.

      const angle = angleRef.current;

      // ---- 휠 배경 글로우 ----
      const glowPulse = 0.7 + 0.3 * Math.sin(now / 900);
      const bgGlow = ctx.createRadialGradient(
        STAGE_CENTER.x,
        STAGE_CENTER.y,
        WHEEL_RADIUS * 0.2,
        STAGE_CENTER.x,
        STAGE_CENTER.y,
        WHEEL_RADIUS * 1.35 * glowPulse
      );
      bgGlow.addColorStop(0, "rgba(49,231,255,0.14)");
      bgGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.fillStyle = bgGlow;
      ctx.beginPath();
      ctx.arc(STAGE_CENTER.x, STAGE_CENTER.y, WHEEL_RADIUS * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ---- 슬라이스 ----
      for (let i = 0; i < RANKS.length; i++) {
        const rank = RANKS[i];
        const prize = prizesRef.current.find((p) => p.rank === rank);
        const soldOut = prize ? prize.remaining_quantity <= 0 : false;
        const isLanded = phase === "flash" && landedRankRef.current === rank;
        const colors = RANK_COLOR[rank] ?? RANK_COLOR[5];

        const sliceStart = angle + SLICE_BASE_START + i * SLICE_ANGLE;
        const sliceEnd = sliceStart + SLICE_ANGLE;

        ctx.save();
        ctx.globalAlpha = soldOut ? 0.25 : 1;
        ctx.beginPath();
        ctx.moveTo(STAGE_CENTER.x, STAGE_CENTER.y);
        ctx.arc(STAGE_CENTER.x, STAGE_CENTER.y, WHEEL_RADIUS, sliceStart, sliceEnd);
        ctx.closePath();
        ctx.fillStyle = colors.core;
        ctx.fill();
        if (isLanded) {
          const flashT = elapsed / FLASH_MS;
          ctx.globalAlpha = Math.max(0, 1 - flashT) * 0.5;
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
        }
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(4,8,20,0.55)";
        ctx.stroke();
        ctx.restore();

        // 라벨(등수) - 슬라이스 중심선을 따라 바깥쪽을 향하도록 회전.
        // 원 아래쪽 절반에서는 그대로 두면 글자가 거꾸로 보이므로 180도 뒤집어 항상 바로 읽히게 한다.
        const labelAngle = angle - Math.PI / 2 + i * SLICE_ANGLE;
        let textRotation = labelAngle + Math.PI / 2;
        const normalizedRotation = Math.atan2(Math.sin(textRotation), Math.cos(textRotation));
        const upsideDown = Math.abs(normalizedRotation) > Math.PI / 2;
        if (upsideDown) textRotation += Math.PI;
        const dir = upsideDown ? 1 : -1;

        ctx.save();
        ctx.globalAlpha = soldOut ? 0.35 : 1;
        ctx.translate(STAGE_CENTER.x, STAGE_CENTER.y);
        ctx.rotate(textRotation);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;

        const rankFontSize = Math.max(20, Math.round(WHEEL_RADIUS * 0.17));
        ctx.font = `800 ${rankFontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
        ctx.lineWidth = rankFontSize * 0.09;
        ctx.strokeStyle = "rgba(4,8,20,0.75)";
        ctx.strokeText(`${rank}등`, 0, dir * WHEEL_RADIUS * 0.55);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(`${rank}등`, 0, dir * WHEEL_RADIUS * 0.55);
        ctx.restore();
      }

      // ---- 중앙 허브 ----
      ctx.save();
      const hubGradient = ctx.createRadialGradient(
        STAGE_CENTER.x,
        STAGE_CENTER.y,
        0,
        STAGE_CENTER.x,
        STAGE_CENTER.y,
        HUB_RADIUS
      );
      hubGradient.addColorStop(0, "rgba(20,28,48,0.95)");
      hubGradient.addColorStop(1, "rgba(6,10,20,0.95)");
      ctx.fillStyle = hubGradient;
      ctx.beginPath();
      ctx.arc(STAGE_CENTER.x, STAGE_CENTER.y, HUB_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(49,231,255,0.65)";
      ctx.stroke();
      ctx.restore();

      // ---- 외곽 림 ----
      ctx.save();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(STAGE_CENTER.x, STAGE_CENTER.y, WHEEL_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // ---- 포인터(고정, 회전하지 않음) ----
      const pointerTipY = STAGE_CENTER.y - WHEEL_RADIUS - 6;
      ctx.save();
      if (phase === "flash") {
        const flashT = elapsed / FLASH_MS;
        ctx.shadowColor = "#FFFFFF";
        ctx.shadowBlur = 30 * Math.max(0, 1 - flashT);
      }
      ctx.beginPath();
      ctx.moveTo(STAGE_CENTER.x - 20, pointerTipY - 34);
      ctx.lineTo(STAGE_CENTER.x + 20, pointerTipY - 34);
      ctx.lineTo(STAGE_CENTER.x, pointerTipY);
      ctx.closePath();
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(49,231,255,0.85)";
      ctx.stroke();
      ctx.restore();

      if (phase === "flash") {
        drawBurst(STAGE_CENTER.x, pointerTipY, 26, elapsed / FLASH_MS);
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
