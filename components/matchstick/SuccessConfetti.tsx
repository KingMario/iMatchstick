import { type CSSProperties } from "react";

export function SuccessConfetti() {
  return (
    <div className="success-confetti" aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => (
        <i
          key={index}
          style={
            {
              "--piece-x": `${8 + ((index * 37) % 84)}%`,
              "--piece-drift": `${(index % 2 ? 1 : -1) * (12 + index * 2)}px`,
              "--piece-delay": `${(index % 4) * 65}ms`,
              "--piece-color": ["#237a50", "#d74a58", "#287ec0", "#ca9b16"][
                index % 4
              ],
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
