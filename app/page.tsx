"use client";

import dynamic from "next/dynamic";
import { LaunchScreen } from "@/components/matchstick/LaunchScreen";

const MatchstickGame = dynamic(
  () =>
    import("@/components/MatchstickGame").then(
      (module) => module.MatchstickGame,
    ),
  {
    ssr: false,
    loading: () => <LaunchScreen />,
  },
);

export default function Home() {
  return <MatchstickGame />;
}
