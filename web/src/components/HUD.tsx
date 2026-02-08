"use client";

interface HUDProps {
  scores: number[];
  currentAttempt: number;
  maxAttempts: number;
  totalScore: number;
}

export default function HUD({
  scores,
  currentAttempt,
  maxAttempts,
  totalScore,
}: HUDProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-cyan-500/30">
      {/* Attempts */}
      <div className="flex gap-2 items-center">
        {Array.from({ length: maxAttempts }).map((_, i) => (
          <div key={i} className="flex items-center gap-1">
            <div
              className={`w-3 h-3 rounded-full ${
                i < currentAttempt
                  ? "bg-pink-500 shadow-[0_0_8px_#ff2d95]"
                  : i === currentAttempt
                    ? "bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-pulse"
                    : "bg-gray-700"
              }`}
            />
            {scores[i] !== undefined && (
              <span className="text-xs text-gray-400 tabular-nums">
                {scores[i]}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider">
          Total
        </span>
        <span
          className="text-xl font-bold tabular-nums"
          style={{
            color: "#ffe814",
            textShadow: "0 0 10px rgba(255,232,20,0.5)",
          }}
        >
          {totalScore}
        </span>
      </div>
    </div>
  );
}
