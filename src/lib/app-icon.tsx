// The app icon, drawn for next/og's ImageResponse: a blue tile with a white "m".
// `fullBleed` fills the square (iOS and "maskable" Android icons crop it themselves).

export function AppIcon({ size, fullBleed = false }: { size: number; fullBleed?: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: fullBleed ? "#2d55c8" : "transparent",
      }}
    >
      <div
        style={{
          width: fullBleed ? "100%" : "88%",
          height: fullBleed ? "100%" : "88%",
          borderRadius: fullBleed ? 0 : size * 0.2,
          background: "#2d55c8",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Maskable icons keep their content inside the central 80% safe zone.
          fontSize: size * (fullBleed ? 0.5 : 0.56),
          fontWeight: 700,
          letterSpacing: -size * 0.02,
          paddingBottom: size * 0.06,
        }}
      >
        m
      </div>
    </div>
  );
}
