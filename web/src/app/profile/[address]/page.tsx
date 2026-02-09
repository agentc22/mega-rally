"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import Link from "next/link";
import WalletConnect from "@/components/WalletConnect";
import { usePlayerHistory } from "@/hooks/usePlayerHistory";
import type { TournamentHistoryEntry } from "@/hooks/usePlayerHistory";
import { usePendingWithdrawal, useWithdraw } from "@/hooks/useWithdraw";
import { megaethTestnet } from "@/lib/chains";

const ATTEMPTS_PER_TICKET = 3;

export default function ProfilePage() {
  const params = useParams();
  const profileAddress = params.address as string;
  const { address: connectedAddress } = useAccount();
  const isOwnProfile =
    connectedAddress?.toLowerCase() === profileAddress?.toLowerCase();

  const { history, isLoading } = usePlayerHistory(profileAddress);
  const { data: pendingAmount, refetch: refetchPending } =
    usePendingWithdrawal(profileAddress);
  const withdraw = useWithdraw();
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const hasPending = pendingAmount && pendingAmount > 0n;
  const explorerUrl = megaethTestnet.blockExplorers?.default?.url;

  const handleWithdraw = async () => {
    try {
      setWithdrawing(true);
      setWithdrawSuccess(false);
      await withdraw();
      setWithdrawSuccess(true);
      refetchPending();
    } catch (err) {
      console.error("[withdraw] error:", err);
    } finally {
      setWithdrawing(false);
    }
  };

  // Stats
  const totalTournaments = history.length;
  const totalWins = history.filter(
    (h) => h.winner.toLowerCase() === profileAddress?.toLowerCase()
  ).length;
  const overallBest = history.reduce((best, h) => Math.max(best, h.bestScore), 0);

  return (
    <div className="min-h-screen" style={{ background: "#0a0a1a" }}>
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
        style={{
          background: "rgba(10, 10, 26, 0.95)",
          borderBottom: "1px solid rgba(0, 240, 255, 0.1)",
        }}
      >
        <Link
          href="/"
          className="text-sm font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          &larr; MEGA RALLY
        </Link>
        <WalletConnect />
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-12">
        {/* Profile Header */}
        <div
          className="rounded-xl p-5 mb-4 border"
          style={{
            background: "rgba(10, 10, 26, 0.8)",
            borderColor: "rgba(0, 240, 255, 0.2)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
              style={{
                background: "linear-gradient(135deg, #00f0ff, #b024ff)",
                color: "#000",
              }}
            >
              {profileAddress?.slice(2, 4).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="font-mono font-bold text-sm"
                  style={{ color: "#00f0ff" }}
                >
                  {profileAddress?.slice(0, 6)}...{profileAddress?.slice(-4)}
                </span>
                {isOwnProfile && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400">
                    you
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-gray-600 truncate">
                {profileAddress}
              </div>
            </div>
          </div>
          {explorerUrl && (
            <a
              href={`${explorerUrl}/address/${profileAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              View on Explorer &rarr;
            </a>
          )}

          {/* Stats row */}
          {!isLoading && history.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5">
              <div className="text-center">
                <div className="text-xs text-gray-500">Tournaments</div>
                <div className="text-lg font-bold text-white">
                  {totalTournaments}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Wins</div>
                <div
                  className="text-lg font-bold"
                  style={{ color: totalWins > 0 ? "#ffe814" : "#fff" }}
                >
                  {totalWins}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Best Score</div>
                <div
                  className="text-lg font-bold"
                  style={{
                    color: "#ffe814",
                    textShadow: "0 0 6px rgba(255,232,20,0.3)",
                  }}
                >
                  {overallBest}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Withdraw Banner */}
        {isOwnProfile && hasPending && (
          <div
            className="rounded-xl p-4 mb-4 border"
            style={{
              background: "rgba(0, 200, 100, 0.05)",
              borderColor: "rgba(0, 240, 180, 0.3)",
              boxShadow: "0 0 20px rgba(0, 240, 180, 0.08)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-400 mb-1">
                  Pending Winnings
                </div>
                <div className="text-xl font-bold text-white">
                  {formatEther(pendingAmount)} ETH
                </div>
              </div>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="px-5 py-2.5 rounded-lg font-bold text-black transition-all hover:scale-105 disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #00f0aa, #00d4ff)",
                }}
              >
                {withdrawing ? "WITHDRAWING..." : "WITHDRAW"}
              </button>
            </div>
            {withdrawSuccess && (
              <div className="text-xs text-emerald-400 mt-2">
                Withdrawal successful!
              </div>
            )}
          </div>
        )}

        {/* Tournament History */}
        <div className="mb-3">
          <h2
            className="text-sm font-bold uppercase tracking-wider"
            style={{ color: "#00f0ff" }}
          >
            Tournament History
          </h2>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-500 animate-pulse">
              Loading tournament history...
            </div>
          </div>
        ) : history.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center border"
            style={{
              background: "rgba(10, 10, 26, 0.8)",
              borderColor: "#222",
            }}
          >
            <div className="text-gray-500 text-sm">
              No tournaments played yet
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => (
              <TournamentHistoryCard
                key={entry.tournamentId}
                entry={entry}
                playerAddress={profileAddress}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TournamentHistoryCard({
  entry,
  playerAddress,
}: {
  entry: TournamentHistoryEntry;
  playerAddress: string;
}) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isActive = !entry.ended && entry.endTime > now;
  const isExpired = !entry.ended && entry.endTime <= now;
  const isWinner =
    entry.winner.toLowerCase() === playerAddress.toLowerCase();

  return (
    <div
      className="rounded-xl p-4 border transition-all"
      style={{
        background: "rgba(10, 10, 26, 0.8)",
        borderColor: isWinner
          ? "#ffe814"
          : isActive
            ? "#00f0ff"
            : "#222",
        boxShadow: isWinner
          ? "0 0 15px rgba(255, 232, 20, 0.1)"
          : isActive
            ? "0 0 15px rgba(0, 240, 255, 0.08)"
            : "none",
      }}
    >
      {/* Tournament header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3
            className="font-bold"
            style={{
              color: isActive ? "#00f0ff" : "#666",
            }}
          >
            Tournament #{entry.tournamentId}
          </h3>
          {isWinner && (
            <span
              className="text-xs px-2 py-0.5 rounded font-bold"
              style={{
                background: "rgba(255, 232, 20, 0.15)",
                color: "#ffe814",
              }}
            >
              WINNER
            </span>
          )}
        </div>
        {entry.ended ? (
          <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500">
            ENDED
          </span>
        ) : isActive ? (
          <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
            LIVE
          </span>
        ) : isExpired ? (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            EXPIRED
          </span>
        ) : null}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 mb-3 text-center">
        <div>
          <div className="text-xs text-gray-500">Prize Pool</div>
          <div className="text-sm font-bold" style={{ color: "#ffe814" }}>
            {formatEther(entry.prizePool)} ETH
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Tickets</div>
          <div className="text-sm font-bold text-white">{entry.tickets}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Best</div>
          <div
            className="text-sm font-bold"
            style={{
              color: "#ffe814",
              textShadow: "0 0 6px rgba(255,232,20,0.3)",
            }}
          >
            {entry.bestScore}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-sm font-bold text-white">{entry.totalScore}</div>
        </div>
      </div>

      {/* Ticket groups with scores */}
      <div className="space-y-1.5">
        {Array.from({ length: entry.tickets }, (_, t) => {
          const startIdx = t * ATTEMPTS_PER_TICKET;
          const ticketScores: number[] = [];
          for (let a = 0; a < ATTEMPTS_PER_TICKET; a++) {
            const idx = startIdx + a;
            if (idx < entry.attemptsUsed) {
              ticketScores.push(entry.scores[idx]);
            }
          }
          if (ticketScores.length === 0) return null;

          const ticketTotal = ticketScores.reduce((a, b) => a + b, 0);

          return (
            <div
              key={t}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/5 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-purple-400 bg-purple-500/15 px-1 rounded">
                  T{t + 1}
                </span>
                <span className="text-gray-400 font-mono text-xs">
                  {ticketScores.join(" + ")}
                </span>
              </div>
              <span
                className="font-bold tabular-nums"
                style={{ color: "#ffe814" }}
              >
                {ticketTotal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
