export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-background" />

      {/* Soft vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, oklch(0.16 0.02 275 / 22%), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, oklch(0.14 0.018 265 / 18%), transparent 50%), radial-gradient(ellipse 60% 40% at 0% 80%, oklch(0.13 0.015 280 / 12%), transparent 45%)",
        }}
      />

      {/* Diffuse radial glows */}
      <div
        className="absolute -top-[28%] left-[12%] h-[55vh] w-[42vw] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.32 0.04 275 / 14%) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute top-[35%] -right-[8%] h-[45vh] w-[35vw] rounded-full blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.28 0.03 265 / 10%) 0%, transparent 68%)",
        }}
      />
      <div
        className="absolute -bottom-[15%] left-[25%] h-[40vh] w-[50vw] rounded-full blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.22 0.025 280 / 8%) 0%, transparent 72%)",
        }}
      />

      <div className="cos-noise absolute inset-0" />
    </div>
  );
}
