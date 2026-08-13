export function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(49,231,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(49,231,255,0.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div
        className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(0,70,255,0.35), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-40 right-[15%] h-[500px] w-[500px] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(49,231,255,0.3), transparent 70%)" }}
      />
    </div>
  );
}
