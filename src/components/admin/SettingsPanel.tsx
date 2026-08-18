"use client";

import { useEffect, useState } from "react";

type FixedDrawKey = "rank1_fixed_draw_number" | "rank2_fixed_draw_number" | "rank3_fixed_draw_number";

export function SettingsPanel() {
  const [settings, setSettings] = useState<{
    allow_duplicate_phone: boolean;
    test_mode: boolean;
    rank1_fixed_draw_number: number | null;
    rank2_fixed_draw_number: number | null;
    rank3_fixed_draw_number: number | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data.settings));
  }, []);

  async function toggle(key: "allow_duplicate_phone" | "test_mode") {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next[key] }),
    });
    setSaving(false);
  }

  async function saveFixedDrawNumber(key: FixedDrawKey, value: number | null) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-[16px] font-bold text-neutral-900">이벤트 설정</h2>
      <p className="mt-1 text-[13px] text-neutral-400">
        {saving ? "저장 중..." : "변경사항은 즉시 반영됩니다."}
      </p>

      <div className="mt-5 flex flex-col divide-y divide-neutral-100">
        <div className="flex items-center justify-between py-4">
          <div>
            <div className="text-[14px] font-semibold text-neutral-800">TEST MODE</div>
            <p className="mt-0.5 text-[12.5px] text-neutral-400">
              활성화 시 새 설문 응답은 테스트 데이터로 표시되며, 참여 인원 상한(200명)에
              포함되지 않습니다. 리허설 후 &quot;참가자+당첨 데이터 전체 초기화&quot;로 정리하세요.
            </p>
          </div>
          <ToggleSwitch checked={settings?.test_mode ?? false} onChange={() => toggle("test_mode")} />
        </div>

        <div className="flex items-center justify-between py-4">
          <div>
            <div className="text-[14px] font-semibold text-neutral-800">중복 휴대전화 허용 안내</div>
            <p className="mt-0.5 text-[12.5px] text-neutral-400">
              데이터 무결성을 위해 휴대전화 번호는 DB에서 항상 UNIQUE로 보호됩니다. 이 옵션은
              중복 시도 시 안내 메시지 톤을 조정하는 용도입니다.
            </p>
          </div>
          <ToggleSwitch
            checked={settings?.allow_duplicate_phone ?? false}
            onChange={() => toggle("allow_duplicate_phone")}
          />
        </div>

        <FixedDrawRow
          label="1등 고정 추첨 순번"
          description="전체 추첨 중 몇 번째 순번에서 1등이 나오게 할지 지정합니다. 1등은 재고가 1개뿐이라
            지정 순번 이전에는 랜덤 대상에서 제외되고, 순번에 도달하면 반드시 1등이 나옵니다.
            비워두면 완전 랜덤으로 동작합니다."
          value={settings?.rank1_fixed_draw_number ?? null}
          onSave={(v) => saveFixedDrawNumber("rank1_fixed_draw_number", v)}
        />

        <FixedDrawRow
          label="2등 고정 추첨 순번 (마지막 1개)"
          description="2등 재고가 마지막 1개 남았을 때만 적용됩니다. 그 전까지 나가는 2등은 지금처럼
            완전 랜덤이고, 마지막 1개는 지정 순번 이전엔 제외되었다가 그 순번에 반드시 나옵니다.
            비워두면 완전 랜덤으로 동작합니다."
          value={settings?.rank2_fixed_draw_number ?? null}
          onSave={(v) => saveFixedDrawNumber("rank2_fixed_draw_number", v)}
        />

        <FixedDrawRow
          label="3등 고정 추첨 순번 (마지막 1개)"
          description="3등 재고가 마지막 1개 남았을 때만 적용됩니다. 그 전까지 나가는 3등은 지금처럼
            완전 랜덤이고, 마지막 1개는 지정 순번 이전엔 제외되었다가 그 순번에 반드시 나옵니다.
            비워두면 완전 랜덤으로 동작합니다."
          value={settings?.rank3_fixed_draw_number ?? null}
          onSave={(v) => saveFixedDrawNumber("rank3_fixed_draw_number", v)}
        />
      </div>
    </div>
  );
}

function FixedDrawRow({
  label,
  description,
  value,
  onSave,
}: {
  label: string;
  description: string;
  value: number | null;
  onSave: (value: number | null) => void;
}) {
  const [input, setInput] = useState(value?.toString() ?? "");

  useEffect(() => {
    setInput(value?.toString() ?? "");
  }, [value]);

  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <div className="text-[14px] font-semibold text-neutral-800">{label}</div>
        <p className="mt-0.5 text-[12.5px] text-neutral-400">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          type="number"
          min={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 175"
          className="w-20 rounded-lg border border-neutral-200 px-2 py-1.5 text-[13px] text-neutral-800"
        />
        <button
          onClick={() => {
            const n = parseInt(input, 10);
            const valid = Number.isInteger(n) && n > 0;
            onSave(valid ? n : null);
            if (!valid) setInput("");
          }}
          className="rounded-lg bg-sh-blue px-3 py-1.5 text-[13px] font-semibold text-white"
        >
          적용
        </button>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-sh-blue" : "bg-neutral-200"
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
