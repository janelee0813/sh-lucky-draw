"use client";

import { useEffect, useState } from "react";
import { StatsCards } from "./StatsCards";
import { SurveyInsights, type SurveyStats } from "./SurveyInsights";
import { ParticipantsTable } from "./ParticipantsTable";
import { PrizesTable } from "./PrizesTable";
import { SettingsPanel } from "./SettingsPanel";
import { ResetPanel } from "./ResetPanel";
import { StartRoundPanel } from "./StartRoundPanel";

type Tab = "dashboard" | "participants" | "prizes" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "DASHBOARD" },
  { key: "participants", label: "PARTICIPANTS" },
  { key: "prizes", label: "PRIZES" },
  { key: "settings", label: "SETTINGS" },
];

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<
    | ({
        totalParticipants: number;
        drawnCount: number;
        pendingDrawCount: number;
        remainingPrizes: number;
      } & SurveyStats)
    | null
  >(null);

  useEffect(() => {
    function loadStats() {
      fetch("/api/admin/stats")
        .then((res) => res.json())
        .then(setStats);
    }
    loadStats();
    // 다른 화면(TV 등)에서 발생하는 참여/추첨을 실시간에 가깝게 반영하기 위해 주기적으로 갱신한다.
    if (tab !== "dashboard") return;
    const timer = setInterval(loadStats, 8000);
    return () => clearInterval(timer);
  }, [tab]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="flex min-h-[100dvh] bg-neutral-50">
      <aside className="hidden w-[220px] shrink-0 flex-col justify-between border-r border-neutral-200 bg-white px-5 py-8 md:flex">
        <div>
          <div className="px-2 text-[13px] font-extrabold tracking-widest text-sh-blue">SH</div>
          <div className="px-2 text-[11px] font-semibold tracking-widest text-neutral-400">
            LUCKY DRAW ADMIN
          </div>

          <nav className="mt-8 flex flex-col gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-2.5 text-left text-[13px] font-bold tracking-wide transition-colors ${
                  tab === t.key
                    ? "bg-sh-blue/10 text-sh-blue"
                    : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-neutral-400 hover:bg-neutral-100"
        >
          로그아웃
        </button>
      </aside>

      <main className="flex-1 px-5 py-8 md:px-10">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
          <div className="flex items-center justify-between md:hidden">
            <div className="text-[13px] font-extrabold tracking-widest text-sh-blue">SH ADMIN</div>
            <button onClick={handleLogout} className="text-[12px] text-neutral-400">
              로그아웃
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto md:hidden">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold ${
                  tab === t.key ? "bg-sh-blue text-white" : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "dashboard" && (
            <>
              <div className="flex items-center justify-end">
                <a
                  href="/api/admin/stats/export"
                  className="whitespace-nowrap rounded-lg bg-sh-blue px-4 py-2 text-[13px] font-bold text-white"
                >
                  통계 Excel 다운로드
                </a>
              </div>
              <SurveyInsights stats={stats} />
              <StatsCards stats={stats} />
              <PrizesTable />
            </>
          )}
          {tab === "participants" && <ParticipantsTable />}
          {tab === "prizes" && <PrizesTable />}
          {tab === "settings" && (
            <>
              <SettingsPanel />
              <StartRoundPanel />
              <ResetPanel />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
