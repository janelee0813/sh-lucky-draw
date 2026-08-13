"use client";

import { Fragment, useEffect, useState } from "react";
import {
  HQ_LOCATION_OPTIONS,
  JOB_ROLE_OPTIONS,
  RND_DEPT_OPTIONS,
  RND_RELOCATION_OPTIONS,
  SURVEY_QUESTIONS,
  optionLabel,
} from "@/lib/config/survey-questions";

type ParticipantRow = {
  id: string;
  ticket_number: number;
  created_at: string;
  name: string;
  company: string | null;
  job_role: string | null;
  rnd_dept: string | null;
  rnd_dept_name: string | null;
  rnd_relocation_plan: string | null;
  hq_location: string | null;
  hq_location_other: string | null;
  phone: string;
  email: string;
  survey_answer_1: string;
  survey_answer_2: string;
  drawn_at: string | null;
  received: boolean;
  received_at: string | null;
  is_test: boolean;
  prizes: { rank: number; name: string } | null;
};

const FILTERS = [
  { value: "all", label: "전체" },
  { value: "not_drawn", label: "미추첨" },
  { value: "drawn", label: "추첨완료" },
  { value: "rank1", label: "1등" },
  { value: "rank2", label: "2등" },
  { value: "rank3", label: "3등" },
  { value: "rank4", label: "4등" },
  { value: "rank5", label: "5등" },
];

export function ParticipantsTable() {
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ q, filter, page: "1", pageSize: "100" });
    const res = await fetch(`/api/admin/participants?${params.toString()}`);
    const data = await res.json();
    setRows(data.participants ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter]);

  async function toggleReceived(id: string, current: boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, received: !current } : r)));
    await fetch(`/api/admin/participants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ received: !current }),
    });
  }

  async function handleDelete(r: ParticipantRow) {
    const prizeNote = r.prizes ? `\n(당첨 상품 "${r.prizes.name}"의 재고는 자동으로 복구됩니다)` : "";
    const confirmed = window.confirm(
      `${String(r.ticket_number).padStart(4, "0")} · ${r.name} 참가자를 삭제할까요?${prizeNote}\n삭제 후에는 되돌릴 수 없습니다.`
    );
    if (!confirmed) return;

    setDeletingId(r.id);
    const res = await fetch(`/api/admin/participants/${r.id}`, { method: "DELETE" });
    setDeletingId(null);

    if (!res.ok) {
      alert("삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setRows((prev) => prev.filter((row) => row.id !== r.id));
    setTotal((prev) => Math.max(0, prev - 1));
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[16px] font-bold text-neutral-900">
          참가자 리스트 <span className="text-neutral-400 font-normal">({total}명)</span>
        </h2>
        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="응모번호 / 이름 / 휴대전화 / 회사 / 이메일 검색"
            className="w-full max-w-[280px] rounded-lg border border-neutral-200 px-3 py-2 text-[13px] outline-none focus:border-sh-blue"
          />
          <a
            href="/api/admin/participants/export"
            className="whitespace-nowrap rounded-lg bg-sh-blue px-4 py-2 text-[13px] font-bold text-white"
          >
            Excel 다운로드
          </a>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              filter === f.value
                ? "bg-sh-blue text-white"
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1500px] text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-neutral-100 text-neutral-400">
              <th className="py-2 pr-3 font-semibold">응모번호</th>
              <th className="py-2 pr-3 font-semibold">참여시간</th>
              <th className="py-2 pr-3 font-semibold">이름</th>
              <th className="py-2 pr-3 font-semibold">회사 / 직무</th>
              <th className="py-2 pr-3 font-semibold">Q1. 관심 블록/필지</th>
              <th className="py-2 pr-3 font-semibold">Q2. 입주 결정 요소</th>
              <th className="py-2 pr-3 font-semibold">R&amp;D 부서</th>
              <th className="py-2 pr-3 font-semibold">본사/연구실 위치</th>
              <th className="py-2 pr-3 font-semibold">휴대전화</th>
              <th className="py-2 pr-3 font-semibold">이메일</th>
              <th className="py-2 pr-3 font-semibold">당첨</th>
              <th className="py-2 pr-3 font-semibold">수령</th>
              <th className="py-2 pr-3 font-semibold">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} className="py-8 text-center text-neutral-300">
                  불러오는 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-8 text-center text-neutral-300">
                  참가자가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const q1Label = optionLabel(SURVEY_QUESTIONS[0].options, r.survey_answer_1);
                const q2Label = optionLabel(SURVEY_QUESTIONS[1].options, r.survey_answer_2);
                const isExpanded = expandedId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className="border-b border-neutral-50 align-top">
                      <td className="py-2.5 pr-3 font-bold text-neutral-900">
                        {String(r.ticket_number).padStart(4, "0")}
                        {r.is_test && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                            TEST
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-500">
                        {new Date(r.created_at).toLocaleString("ko-KR")}
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-700">{r.name}</td>
                      <td className="py-2.5 pr-3 text-neutral-500">
                        <div className="text-neutral-700">{r.company || "-"}</div>
                        <div className="text-[11px] text-neutral-400">
                          {optionLabel(JOB_ROLE_OPTIONS, r.job_role) || "-"}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-600">
                        <span className="block max-w-[220px] truncate" title={q1Label}>
                          {q1Label || "-"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-600">
                        <span className="block max-w-[200px] truncate" title={q2Label}>
                          {q2Label || "-"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-500">
                        {optionLabel(RND_DEPT_OPTIONS, r.rnd_dept) || "-"}
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-500">
                        {r.hq_location === "etc"
                          ? `기타(${r.hq_location_other || "-"})`
                          : optionLabel(HQ_LOCATION_OPTIONS, r.hq_location) || "-"}
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-500">{r.phone}</td>
                      <td className="py-2.5 pr-3 text-neutral-500">{r.email}</td>
                      <td className="py-2.5 pr-3">
                        {r.prizes ? (
                          <span className="font-bold text-sh-blue">
                            {r.prizes.rank}등 · {r.prizes.name}
                          </span>
                        ) : r.drawn_at ? (
                          <span className="text-neutral-400">-</span>
                        ) : (
                          <span className="text-neutral-300">미추첨</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        {r.prizes ? (
                          <button
                            onClick={() => toggleReceived(r.id, r.received)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              r.received
                                ? "bg-sh-blue/10 text-sh-blue"
                                : "bg-neutral-100 text-neutral-400"
                            }`}
                          >
                            {r.received ? "수령완료" : "미수령"}
                          </button>
                        ) : (
                          <span className="text-neutral-200">-</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : r.id)}
                            className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-500 hover:bg-neutral-200"
                          >
                            {isExpanded ? "접기" : "상세"}
                          </button>
                          <button
                            onClick={() => handleDelete(r)}
                            disabled={deletingId === r.id}
                            className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500 hover:bg-red-100 disabled:opacity-40"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-neutral-100 bg-neutral-50">
                        <td colSpan={13} className="px-3 py-4">
                          <div className="grid grid-cols-1 gap-3 text-[12.5px] sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <div className="font-semibold text-neutral-400">Q1 전체 응답</div>
                              <div className="mt-0.5 text-neutral-700">{q1Label || "-"}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-neutral-400">Q2 전체 응답</div>
                              <div className="mt-0.5 text-neutral-700">{q2Label || "-"}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-neutral-400">R&amp;D 부서/연구소명</div>
                              <div className="mt-0.5 text-neutral-700">{r.rnd_dept_name || "-"}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-neutral-400">R&amp;D 이전/확장 계획</div>
                              <div className="mt-0.5 text-neutral-700">
                                {optionLabel(RND_RELOCATION_OPTIONS, r.rnd_relocation_plan) || "-"}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-neutral-400">본사/연구실 위치(직접입력)</div>
                              <div className="mt-0.5 text-neutral-700">{r.hq_location_other || "-"}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
