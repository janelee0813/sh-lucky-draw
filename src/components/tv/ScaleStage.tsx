"use client";

import { useEffect, useRef, useState } from "react";

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

export function ScaleStage({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const el = wrapperRef.current;
      if (!el) return;
      const { clientWidth, clientHeight } = el;
      const scaleX = clientWidth / STAGE_WIDTH;
      const scaleY = clientHeight / STAGE_HEIGHT;
      setScale(Math.min(scaleX, scaleY));
    }
    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    window.addEventListener("resize", updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="tv-root fixed inset-0 flex items-center justify-center bg-black"
    >
      <div
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
        className="relative shrink-0"
      >
        {children}
      </div>
    </div>
  );
}
