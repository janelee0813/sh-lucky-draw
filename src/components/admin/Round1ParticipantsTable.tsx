"use client";

import { ParticipantsTable } from "./ParticipantsTable";

// 1차(보관된) 참가자 조회 전용 화면. 수정/삭제 없이 조회 + Excel 다운로드만 가능하다.
export function Round1ParticipantsTable() {
  return (
    <ParticipantsTable
      apiBase="/api/admin/archive/participants"
      extraParams={{ round: "1" }}
      exportUrl="/api/admin/archive/export?round=1"
      title="1차 참가자 리스트 및 설문결과"
      readOnly
    />
  );
}
