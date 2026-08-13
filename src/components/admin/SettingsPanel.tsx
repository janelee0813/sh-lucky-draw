"use client";

import { useEffect, useState } from "react";

export function SettingsPanel() {
  const [settings, setSettings] = useState<{
    allow_duplicate_phone: boolean;
    test_mode: boolean;
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
