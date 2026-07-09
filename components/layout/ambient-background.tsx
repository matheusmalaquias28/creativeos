export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-background" />

      <div
        className="absolute inset-0"
        style={{ background: "var(--ambient-vignette)" }}
      />

      {/* Top-left: very subtle green glow (dark) / purple (light) */}
      <div
        className="absolute -top-[30%] -left-[5%] h-[60vh] w-[45vw] rounded-full blur-[130px]"
        style={{ background: "var(--ambient-glow-a)" }}
      />
      {/* Right: neutral depth */}
      <div
        className="absolute top-[30%] -right-[10%] h-[50vh] w-[38vw] rounded-full blur-[110px]"
        style={{ background: "var(--ambient-glow-b)" }}
      />
      {/* Bottom: subtle depth */}
      <div
        className="absolute -bottom-[20%] left-[20%] h-[45vh] w-[55vw] rounded-full blur-[120px]"
        style={{ background: "var(--ambient-glow-c)" }}
      />

      <div className="cos-noise absolute inset-0" />
    </div>
  );
}
