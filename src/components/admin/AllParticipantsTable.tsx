"use client";

import { ParticipantsTable } from "./ParticipantsTable";

// 1~N차 전체 참가자를 회차 구분과 함께 한 화면에서 보여준다. (조회/Excel 다운로드 전용)
export function AllParticipantsTable() {
  return (
    <ParticipantsTable
      apiBase="/api/admin/participants/all"
      exportUrl="/api/admin/participants/all/export"
      title="ALL ROUNDS 참가자 리스트 및 설문결과"
      readOnly
      showRoundColumn
    />
  );
}
