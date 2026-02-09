"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import Game from "@/components/Game";
import HUD from "@/components/HUD";
import WalletConnect from "@/components/WalletConnect";
import Leaderboard from "@/components/Leaderboard";
import { useEntry } from "@/hooks/useTournament";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useOperator } from "@/hooks/useGame";

const MAX_ATTEMPTS = 3;

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = Number(params.id);
  const { address } = useAccount();

  const [scores, setScores] = useState<number[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [allDone, setAllDone] = useState(false);

  const { data: entry } = useEntry(tournamentId);
  const { entries: leaderboard, refetch: refetchLeaderboard } =
    useLeaderboard(tournamentId);
  const { startAttempt, obstaclePassed, crash } = useOperator();

  const contractAttemptsUsed = entry ? Number(entry.attemptsUsed) : 0;

  // Sync from contract
  const syncedRef = useRef(false);
  useEffect(() => {
    if (
      entry &&
      entry.player !== "0x0000000000000000000000000000000000000000" &&
      !syncedRef.current
    ) {
      syncedRef.current = true;
      setCurrentAttempt(contractAttemptsUsed);
      const contractScores: number[] = [];
      for (let i = 0; i < contractAttemptsUsed; i++) {
        contractScores.push(Number(entry.scores[i]));
      }
      setScores(contractScores);
      setTotalScore(Number(entry.totalScore));
      if (contractAttemptsUsed >= MAX_ATTEMPTS) {
        setAllDone(true);
      }
    }
  }, [entry, contractAttemptsUsed]);

  const handleStart = useCallback(() => {
    if (address) {
      startAttempt(tournamentId);
    }
  }, [address, tournamentId, startAttempt]);

  const handleObstaclePassed = useCallback(
    (obstacleId: number) => {
      if (address) {
        obstaclePassed(obstacleId);
      }
    },
    [address, obstaclePassed]
  );

  const handleGameOver = useCallback(
    (score: number) => {
      if (address) {
        crash();
      }
      const newScores = [...scores, score];
      setScores(newScores);
      const newTotal = newScores.reduce((a, b) => a + b, 0);
      setTotalScore(newTotal);
      const nextAttempt = currentAttempt + 1;
      setCurrentAttempt(nextAttempt);
      if (nextAttempt >= MAX_ATTEMPTS) {
        setAllDone(true);
        setTimeout(() => refetchLeaderboard(), 3000);
      }
    },
    [scores, currentAttempt, address, crash, refetchLeaderboard]
  );

  return (
    <div className="h-dvh flex flex-col bg-[#0a0a1a] overflow-hidden">
      <header className="flex items-center justify-between px-4 py-1 border-b border-cyan-500/20 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-500 hover:text-cyan-400 transition-colors"
          >
            &larr; Back
          </button>
          <span
            className="text-base font-bold tracking-wider"
            style={{
              color: "#00f0ff",
              textShadow: "0 0 10px rgba(0,240,255,0.5)",
            }}
          >
            Tournament #{tournamentId}
          </span>
        </div>
        <WalletConnect />
      </header>

      <div className="shrink-0">
        <HUD
          scores={scores}
          currentAttempt={currentAttempt}
          maxAttempts={MAX_ATTEMPTS}
          totalScore={totalScore}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-1 md:p-4 min-h-0">
        <div className="w-full h-full max-w-4xl">
          <Game
            attemptNumber={currentAttempt}
            maxAttempts={MAX_ATTEMPTS}
            onScoreChange={() => {}}
            onGameOver={handleGameOver}
            onObstaclePassed={handleObstaclePassed}
            onStart={handleStart}
          />
        </div>
      </div>

      {allDone && (
        <div className="px-4 pb-4 space-y-4">
          <div
            className="max-w-4xl mx-auto rounded-xl p-4 border text-center"
            style={{ background: "rgba(0,0,0,0.6)", borderColor: "#ffe814" }}
          >
            <h3
              className="text-xl font-bold mb-2"
              style={{ color: "#ffe814" }}
            >
              ALL ATTEMPTS USED
            </h3>
            <div className="flex justify-center gap-6 mb-3">
              {scores.map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-xs text-gray-500">Run {i + 1}</div>
                  <div className="text-lg font-bold text-cyan-400">{s}</div>
                </div>
              ))}
            </div>
            <div
              className="text-2xl font-bold"
              style={{ color: "#ffe814" }}
            >
              Total: {totalScore}
            </div>
          </div>

          <div className="max-w-md mx-auto">
            <h3
              className="text-sm font-bold uppercase tracking-wider mb-2 text-center"
              style={{ color: "#b024ff" }}
            >
              Leaderboard
            </h3>
            <Leaderboard entries={leaderboard} currentPlayer={address} />
          </div>
        </div>
      )}

      <footer className="text-center py-1 text-xs text-gray-700 border-t border-cyan-500/10 shrink-0">
        Scores verified onchain on MegaETH
      </footer>
    </div>
  );
}
