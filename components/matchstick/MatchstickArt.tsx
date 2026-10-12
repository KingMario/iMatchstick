type Props = {
  orientation: "horizontal" | "vertical";
  reversed?: boolean;
};

export function MatchstickArt({ orientation, reversed = false }: Props) {
  const vertical = orientation === "vertical";
  return (
    <svg
      className="matchstick-art"
      viewBox={vertical ? "0 0 68 240" : "0 0 240 68"}
      aria-hidden="true"
      focusable="false"
      data-reversed={reversed}
      fill="none"
      stroke="#302923"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform={vertical ? "translate(0 240) rotate(-90)" : undefined}>
        <g
          className="matchstick-ink"
          transform={reversed ? "translate(240 68) rotate(180)" : undefined}
        >
          <path
            fill="#f5d58b"
            d="M25 25q25-3.5 49-.7t48 0q29-2.8 69-.7l3 20.4q-27-1.4-51 .7t-47-.7q-36-2.1-69 .7c-4-6-5-14-2-19.7Z"
          />
          <path
            stroke="#fff0c4"
            strokeWidth="5"
            d="M31 31q28-2.1 52 .7t49-.7l48-.7"
          />
          <path
            stroke="#b68b49"
            strokeWidth="1.6"
            d="m31 38 23-2 25 3 22-1m9-3 24 1 20-3 27 1m-146 9 35-2m38 2 30-2"
          />
          <path
            strokeWidth="1.4"
            opacity="0.8"
            d="M24 28q24-4.2 50-1.4m12 0q25 2.1 49-.7l44-.7M25 40l2 7q30-2.1 55-.7m14 0q21 2.1 47 .7l35-1.4"
          />
          <path
            fill="#d74736"
            d="M199 14c10-2 19 7 18 19 1 11-6 19-17 20-7 1-11-5-15-8l3-9-2-11q5-8 13-11Z"
          />
          <path
            stroke="#ef7960"
            strokeWidth="2.2"
            d="m195 24 7-4m-10 10 6-5m3-1 5-1m-4 7 5-3"
          />
          <path
            stroke="#a92c2a"
            strokeWidth="1.8"
            d="m195 43 8 2m-4 3 7-2m0-4 6-6"
          />
          <path
            strokeWidth="1.4"
            opacity="0.8"
            d="M193 16q10-6 18 5m7 6q4 13-8 23m-20-4 6 6"
          />
        </g>
      </g>
    </svg>
  );
}
