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
      <div className="cos-noise absolute inset-0" />
    </div>
  );
}
