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
  round?: number;
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

type ParticipantsTableProps = {
  // 라이브 참가자(기본값)와 보관된 지난 라운드 참가자를 같은 화면으로 보여주기 위한 옵션.
  apiBase?: string;
  extraParams?: Record<string, string>;
  exportUrl?: string;
  title?: string;
  readOnly?: boolean;
  showRoundColumn?: boolean;
};

export function ParticipantsTable({
  apiBase = "/api/admin/participants",
  extraParams = {},
  exportUrl = "/api/admin/participants/export",
  title = "참가자 리스트 및 설문결과",
  readOnly = false,
  showRoundColumn = false,
}: ParticipantsTableProps = {}) {
  const PAGE_SIZE = 100;
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function load(pageToLoad: number) {
    setLoading(true);
    const params = new URLSearchParams({
      q,
      filter,
      page: String(pageToLoad),
      pageSize: String(PAGE_SIZE),
      ...extraParams,
    });
    const res = await fetch(`${apiBase}?${params.toString()}`);
    const data = await res.json();
    setRows(data.participants ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  // 검색어/필터가 바뀌면 1페이지부터 다시 본다. (page 상태 변경은 아래 두번째 effect가 이어서 처리)
  useEffect(() => {
    setPage((prev) => (prev === 1 ? prev : 1));
  }, [q, filter]);

  useEffect(() => {
    const timer = setTimeout(() => load(page), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter, page]);

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
      const data = await res.json().catch(() => null);
      alert(
        `삭제에 실패했습니다. (${res.status} ${data?.error ?? ""}${data?.message ? `: ${data.message}` : ""})`
      );
      return;
    }
    setRows((prev) => prev.filter((row) => row.id !== r.id));
    setTotal((prev) => Math.max(0, prev - 1));
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[16px] font-bold text-neutral-900">
          {title} <span className="text-neutral-400 font-normal">({total}명)</span>
        </h2>
        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="응모번호 / 이름 / 휴대전화 / 회사 / 이메일 검색"
            className="w-full max-w-[280px] rounded-lg border border-neutral-200 px-3 py-2 text-[13px] outline-none focus:border-sh-blue"
          />
          <a
            href={exportUrl}
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
              {showRoundColumn && <th className="py-2 pr-3 font-semibold">회차</th>}
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
                <td colSpan={showRoundColumn ? 14 : 13} className="py-8 text-center text-neutral-300">
                  불러오는 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={showRoundColumn ? 14 : 13} className="py-8 text-center text-neutral-300">
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
                    <tr className="border-b border-neutral-50">
                      {showRoundColumn && (
                        <td className="whitespace-nowrap py-2 pr-3">
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-500">
                            {r.round ?? "-"}차
                          </span>
                        </td>
                      )}
                      <td className="whitespace-nowrap py-2 pr-3 font-bold text-neutral-900">
                        {String(r.ticket_number).padStart(4, "0")}
                        {r.is_test && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                            TEST
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-neutral-500">
                        {new Date(r.created_at).toLocaleString("ko-KR")}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-neutral-700">{r.name}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-neutral-500">
                        <span className="text-neutral-700">{r.company || "-"}</span>
                        <span className="text-neutral-400"> · {optionLabel(JOB_ROLE_OPTIONS, r.job_role) || "-"}</span>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-neutral-600">{q1Label || "-"}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-neutral-600">{q2Label || "-"}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-neutral-500">
                        {optionLabel(RND_DEPT_OPTIONS, r.rnd_dept) || "-"}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-neutral-500">
                        {r.hq_location === "etc"
                          ? `기타(${r.hq_location_other || "-"})`
                          : optionLabel(HQ_LOCATION_OPTIONS, r.hq_location) || "-"}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-neutral-500">{r.phone}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-neutral-500">{r.email}</td>
                      <td className="whitespace-nowrap py-2 pr-3">
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
                      <td className="whitespace-nowrap py-2 pr-3">
                        {r.prizes ? (
                          readOnly ? (
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                r.received ? "bg-sh-blue/10 text-sh-blue" : "bg-neutral-100 text-neutral-400"
                              }`}
                            >
                              {r.received ? "수령완료" : "미수령"}
                            </span>
                          ) : (
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
                          )
                        ) : (
                          <span className="text-neutral-200">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : r.id)}
                            className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-500 hover:bg-neutral-200"
                          >
                            {isExpanded ? "접기" : "상세"}
                          </button>
                          {!readOnly && (
                            <button
                              onClick={() => handleDelete(r)}
                              disabled={deletingId === r.id}
                              className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500 hover:bg-red-100 disabled:opacity-40"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-neutral-100 bg-neutral-50">
                        <td colSpan={showRoundColumn ? 14 : 13} className="px-3 py-4">
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

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-[12.5px] text-neutral-500">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / 총 {total}명
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 font-semibold text-neutral-600 disabled:opacity-30"
            >
              이전
            </button>
            <span className="font-semibold text-neutral-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 font-semibold text-neutral-600 disabled:opacity-30"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
