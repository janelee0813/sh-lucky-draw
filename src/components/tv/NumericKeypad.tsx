"use client";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", ""];

export function NumericKeypad({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  function handlePress(key: string) {
    if (key === "") return;
    if (key === "←") {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= 4) return;
    onChange(value + key);
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {KEYS.map((key, i) => (
        <button
          key={`${key}-${i}`}
          type="button"
          disabled={key === ""}
          onClick={() => handlePress(key)}
          className={`h-20 rounded-2xl text-[28px] font-bold transition-colors active:scale-95 ${
            key === ""
              ? "invisible"
              : key === "←"
              ? "bg-white/5 text-white/60 hover:bg-white/10"
              : "bg-white/[0.06] text-white hover:bg-white/[0.12]"
          }`}
        >
          {key}
        </button>
      ))}
    </div>
  );
}
