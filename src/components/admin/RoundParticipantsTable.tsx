"use client";

import { useEffect, useState } from "react";
import { ParticipantsTable } from "./ParticipantsTable";

// 특정 회차(round)의 참가자를 보여준다.
// - 지금 진행 중인 라운드면 라이브 participants 테이블을 그대로 보여준다(조회/수정/삭제 가능).
// - 이미 끝난 라운드면 보관 테이블(participants_archive)에서 조회 전용으로 보여준다.
// - 아직 시작 전인 라운드면 안내 문구만 보여준다.
// "다음 라운드 시작" 버튼을 누르면 current_round가 올라가므로, 이 컴포넌트는 코드 수정 없이
// 자동으로 라이브 <-> 보관 전환된다.
export function RoundParticipantsTable({ round }: { round: number }) {
  const [currentRound, setCurrentRound] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => setCurrentRound(data?.settings?.current_round ?? 1));
  }, []);

  if (currentRound === null) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-neutral-300">
        불러오는 중...
      </div>
    );
  }

  if (round > currentRound) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-neutral-400">
        ROUND {round}은 아직 시작되지 않았습니다.
        <br />
        SETTINGS 탭에서 다음 라운드를 시작하면 이 화면에 나타납니다.
      </div>
    );
  }

  if (round === currentRound) {
    return <ParticipantsTable title={`ROUND ${round} 참가자 리스트 및 설문결과`} />;
  }

  return (
    <ParticipantsTable
      apiBase="/api/admin/archive/participants"
      extraParams={{ round: String(round) }}
      exportUrl={`/api/admin/archive/export?round=${round}`}
      title={`ROUND ${round} 참가자 리스트 및 설문결과`}
      readOnly
    />
  );
}
