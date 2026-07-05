"use client";

import dynamic from "next/dynamic";

const MatchstickGame = dynamic(
  () =>
    import("@/components/MatchstickGame").then(
      (module) => module.MatchstickGame,
    ),
  {
    ssr: false,
  },
);

export default function Home() {
  return <MatchstickGame />;
}
