"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";

// 화면에 보이는 통계 영역을 이미지(PNG)로 저장한다. (요청: 엑셀 다운로드 옆에 그래프 이미지 다운로드 버튼)
export function useImageDownload(filenamePrefix: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  async function handleDownload() {
    if (!ref.current) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, backgroundColor: "#f9fafb" });
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
        today.getDate()
      ).padStart(2, "0")}`;
      const link = document.createElement("a");
      link.download = `${filenamePrefix}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return { ref, saving, handleDownload };
}
