"use client";

import type { TicketEntry } from "@/hooks/useLeaderboard";

interface LeaderboardProps {
  entries: TicketEntry[];
  currentPlayer?: string;
}

export default function Leaderboard({
  entries,
  currentPlayer,
}: LeaderboardProps) {
  // Sort by ticketScore descending
  const sorted = [...entries].sort((a, b) => b.ticketScore - a.ticketScore);

  // Check if any player has multiple tickets (to decide whether to show badge)
  const ticketCounts = new Map<string, number>();
  for (const e of entries) {
    const key = e.player.toLowerCase();
    ticketCounts.set(key, Math.max(ticketCounts.get(key) ?? 0, e.ticket));
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center text-gray-600 py-4 text-sm">
        No players yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sorted.map((entry, i) => {
        const isMe =
          currentPlayer?.toLowerCase() === entry.player.toLowerCase();
        const showBadge =
          (ticketCounts.get(entry.player.toLowerCase()) ?? 1) > 1;
        return (
          <div
            key={entry.player + "-" + entry.ticket}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
              isMe
                ? "bg-cyan-500/10 border border-cyan-500/30"
                : "bg-white/5"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-6 text-center font-bold ${
                  i === 0
                    ? "text-yellow-400"
                    : i === 1
                      ? "text-gray-300"
                      : i === 2
                        ? "text-amber-600"
                        : "text-gray-500"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`font-mono ${isMe ? "text-cyan-400" : "text-gray-400"}`}
              >
                {entry.player.slice(0, 6)}...{entry.player.slice(-4)}
                {showBadge && (
                  <span className="ml-1 text-[10px] font-bold text-purple-400 bg-purple-500/15 px-1 rounded">
                    T{entry.ticket}
                  </span>
                )}
                {isMe && (
                  <span className="ml-1 text-xs text-cyan-500">(you)</span>
                )}
              </span>
            </div>
            <span
              className="font-bold tabular-nums"
              style={{
                color: "#ffe814",
                textShadow: "0 0 6px rgba(255,232,20,0.3)",
              }}
            >
              {entry.ticketScore}
            </span>
          </div>
        );
      })}
    </div>
  );
}
