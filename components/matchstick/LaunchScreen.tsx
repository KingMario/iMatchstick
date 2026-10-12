export function LaunchScreen() {
  return (
    <div
      className="launch-screen"
      role="status"
      aria-label="游戏加载中 / Loading game"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        background: "#000",
        color: "#fff",
      }}
    >
      <div className="launch-content">
        <div className="launch-image-crop">
          {/* The crop retains the original artwork; copyright is rendered as text. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="./splash.png"
            width={800}
            height={480}
            alt="i-Matchstick · Mario Studio"
            fetchPriority="high"
          />
        </div>
        <p className="launch-copyright">(c) Copyright Mario Studio 2026-2027</p>
        <p className="launch-loading">加载中 / Loading…</p>
        <noscript>请启用 JavaScript / Please enable JavaScript.</noscript>
      </div>
    </div>
  );
}
