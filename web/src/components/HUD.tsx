"use client";

const ATTEMPTS_PER_TICKET = 3;

interface HUDProps {
  scores: number[];
  currentAttempt: number;
  maxAttempts: number;
  totalScore: number;
  currentTicket: number; // 1-indexed
  ticketCount: number;
}

export default function HUD({
  scores,
  currentAttempt,
  maxAttempts,
  totalScore,
  currentTicket,
  ticketCount,
}: HUDProps) {
  // Build ticket groups
  const ticketGroups: { ticket: number; startIdx: number }[] = [];
  for (let t = 0; t < ticketCount; t++) {
    ticketGroups.push({ ticket: t + 1, startIdx: t * ATTEMPTS_PER_TICKET });
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-cyan-500/30">
      {/* Attempts grouped by ticket */}
      <div className="flex gap-1 items-center">
        {ticketGroups.map((group, gi) => {
          // Per-ticket total score
          let ticketTotal = 0;
          let hasScore = false;
          for (let a = 0; a < ATTEMPTS_PER_TICKET; a++) {
            const idx = group.startIdx + a;
            if (scores[idx] !== undefined) {
              ticketTotal += scores[idx];
              hasScore = true;
            }
          }

          return (
            <div key={group.ticket} className="flex items-center gap-1">
              {/* Divider between ticket groups */}
              {gi > 0 && (
                <div className="w-px h-5 bg-purple-500/40 mx-1" />
              )}

              {/* Ticket label (only show if multiple tickets) */}
              {ticketCount > 1 && (
                <span className="text-[9px] font-bold text-purple-400 mr-0.5">
                  T{group.ticket}
                </span>
              )}

              {/* Attempt dots */}
              {Array.from({ length: ATTEMPTS_PER_TICKET }).map((_, a) => {
                const idx = group.startIdx + a;
                if (idx >= maxAttempts) return null;
                return (
                  <div key={idx} className="flex items-center gap-1">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        idx < currentAttempt
                          ? "bg-pink-500 shadow-[0_0_8px_#ff2d95]"
                          : idx === currentAttempt
                            ? "bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-pulse"
                            : "bg-gray-700"
                      }`}
                    />
                    {scores[idx] !== undefined && (
                      <span className="text-xs text-gray-400 tabular-nums">
                        {scores[idx]}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Per-ticket total */}
              {hasScore && ticketCount > 1 && (
                <span
                  className="text-[10px] font-bold tabular-nums ml-0.5"
                  style={{ color: "#ffe814" }}
                >
                  ({ticketTotal})
                </span>
              )}
            </div>
          );
        })}
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
