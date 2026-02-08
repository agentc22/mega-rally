"use client";

import { formatEther } from "viem";

interface TournamentCardProps {
  id: number;
  entryFee: bigint;
  endTime: bigint;
  prizePool: bigint;
  playerCount: number;
  ended: boolean;
  isEntered: boolean;
  onEnter: () => void;
  onPlay: () => void;
  entering: boolean;
}

export default function TournamentCard({
  id,
  entryFee,
  endTime,
  prizePool,
  playerCount,
  ended,
  isEntered,
  onEnter,
  onPlay,
  entering,
}: TournamentCardProps) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isActive = !ended && endTime > now;
  const timeLeft = isActive ? Number(endTime - now) : 0;

  const hours = Math.floor(timeLeft / 3600);
  const mins = Math.floor((timeLeft % 3600) / 60);

  return (
    <div
      className="rounded-xl p-4 border transition-all"
      style={{
        background: "rgba(10, 10, 26, 0.8)",
        borderColor: isActive ? "#00f0ff" : ended ? "#333" : "#555",
        boxShadow: isActive ? "0 0 20px rgba(0, 240, 255, 0.1)" : "none",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3
          className="font-bold text-lg"
          style={{
            color: isActive ? "#00f0ff" : "#666",
          }}
        >
          Tournament #{id}
        </h3>
        {ended ? (
          <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500">
            ENDED
          </span>
        ) : isActive ? (
          <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
            LIVE
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            EXPIRED
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div>
          <div className="text-xs text-gray-500">Entry</div>
          <div className="text-sm font-bold text-white">
            {formatEther(entryFee)} ETH
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Prize Pool</div>
          <div
            className="text-sm font-bold"
            style={{ color: "#ffe814" }}
          >
            {formatEther(prizePool)} ETH
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">
            {isActive ? "Time Left" : "Players"}
          </div>
          <div className="text-sm font-bold text-white">
            {isActive ? `${hours}h ${mins}m` : playerCount}
          </div>
        </div>
      </div>

      {isActive && !isEntered && (
        <button
          onClick={onEnter}
          disabled={entering}
          className="w-full py-2 rounded-lg font-bold text-black transition-all hover:scale-[1.02] disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #00f0ff, #b024ff)",
          }}
        >
          {entering ? "ENTERING..." : `ENTER (${formatEther(entryFee)} ETH)`}
        </button>
      )}

      {isActive && isEntered && (
        <button
          onClick={onPlay}
          className="w-full py-2 rounded-lg font-bold text-black transition-all hover:scale-[1.02]"
          style={{
            background: "linear-gradient(135deg, #ffe814, #ff2d95)",
          }}
        >
          PLAY
        </button>
      )}
    </div>
  );
}
