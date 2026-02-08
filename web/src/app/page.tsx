"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import Game from "@/components/Game";
import HUD from "@/components/HUD";
import WalletConnect from "@/components/WalletConnect";
import TournamentCard from "@/components/TournamentCard";
import Leaderboard from "@/components/Leaderboard";
import {
  useTournamentCount,
  useTournament,
  useEntry,
  useEnterTournament,
} from "@/hooks/useTournament";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useOperator } from "@/hooks/useGame";

const MAX_ATTEMPTS = 3;
const ACTIVE_TOURNAMENT_ID = 1; // first tournament

type View = "lobby" | "game";

export default function Home() {
  const { address, isConnected } = useAccount();
  const [view, setView] = useState<View>("lobby");
  const [scores, setScores] = useState<number[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [entering, setEntering] = useState(false);
  const [allDone, setAllDone] = useState(false);

  // Contract reads
  const { data: tournamentCount } = useTournamentCount();
  const { data: tournament } = useTournament(ACTIVE_TOURNAMENT_ID);
  const { data: entry, refetch: refetchEntry } =
    useEntry(ACTIVE_TOURNAMENT_ID);
  const {
    entries: leaderboard,
    refetch: refetchLeaderboard,
  } = useLeaderboard(ACTIVE_TOURNAMENT_ID);

  const enterTournament = useEnterTournament();
  const { startAttempt, obstaclePassed, crash } = useOperator();

  // Track entry state from contract
  const isEntered = entry ? entry.player !== "0x0000000000000000000000000000000000000000" : false;
  const contractAttemptsUsed = entry ? Number(entry.attemptsUsed) : 0;

  // Sync attempts from contract on load
  const syncedRef = useRef(false);
  useEffect(() => {
    if (isEntered && !syncedRef.current) {
      syncedRef.current = true;
      setCurrentAttempt(contractAttemptsUsed);
      const contractScores: number[] = [];
      for (let i = 0; i < contractAttemptsUsed; i++) {
        contractScores.push(Number(entry!.scores[i]));
      }
      setScores(contractScores);
      setTotalScore(Number(entry!.totalScore));
      if (contractAttemptsUsed >= MAX_ATTEMPTS) {
        setAllDone(true);
      }
    }
  }, [isEntered, contractAttemptsUsed, entry]);

  const handleEnter = useCallback(async () => {
    if (!tournament) return;
    setEntering(true);
    try {
      await enterTournament(ACTIVE_TOURNAMENT_ID, tournament[1]); // entryFee
      await refetchEntry();
    } catch (err) {
      console.error("Enter failed:", err);
    }
    setEntering(false);
  }, [tournament, enterTournament, refetchEntry]);

  const handlePlay = useCallback(() => {
    setView("game");
  }, []);

  const handleScoreChange = useCallback(() => {
    // Real-time score updates happen in Game component
  }, []);

  const handleStart = useCallback(() => {
    if (address) {
      startAttempt(ACTIVE_TOURNAMENT_ID, address);
    }
  }, [address, startAttempt]);

  const handleObstaclePassed = useCallback(
    (obstacleId: number) => {
      if (address) {
        obstaclePassed(address, obstacleId);
      }
    },
    [address, obstaclePassed]
  );

  const handleGameOver = useCallback(
    (score: number) => {
      if (address) {
        crash(address, score);
      }
      const newScores = [...scores, score];
      setScores(newScores);
      const newTotal = newScores.reduce((a, b) => a + b, 0);
      setTotalScore(newTotal);
      const nextAttempt = currentAttempt + 1;
      setCurrentAttempt(nextAttempt);
      if (nextAttempt >= MAX_ATTEMPTS) {
        setAllDone(true);
        // Refresh leaderboard after all attempts
        setTimeout(() => refetchLeaderboard(), 3000);
      }
    },
    [scores, currentAttempt, address, crash, refetchLeaderboard]
  );

  const handleBackToLobby = useCallback(() => {
    setView("lobby");
    refetchLeaderboard();
    refetchEntry();
  }, [refetchLeaderboard, refetchEntry]);

  const handleReset = useCallback(() => {
    setScores([]);
    setCurrentAttempt(0);
    setTotalScore(0);
    setAllDone(false);
  }, []);

  // Parse tournament data
  const tournamentData = tournament
    ? {
        id: Number(tournament[0]),
        entryFee: tournament[1] as bigint,
        startTime: tournament[2] as bigint,
        endTime: tournament[3] as bigint,
        prizePool: tournament[4] as bigint,
        ended: tournament[5] as boolean,
      }
    : null;

  // --- GAME VIEW ---
  if (view === "game") {
    return (
      <div className="min-h-screen flex flex-col bg-[#0a0a1a]">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-cyan-500/20">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToLobby}
              className="text-sm text-gray-500 hover:text-cyan-400 transition-colors"
            >
              &larr; Back
            </button>
            <span
              className="text-lg font-bold tracking-wider"
              style={{
                color: "#00f0ff",
                textShadow: "0 0 10px rgba(0,240,255,0.5)",
              }}
            >
              FLUFFLE DASH
            </span>
          </div>
          <WalletConnect />
        </header>

        {/* HUD */}
        <HUD
          scores={scores}
          currentAttempt={currentAttempt}
          maxAttempts={MAX_ATTEMPTS}
          totalScore={totalScore}
        />

        {/* Game */}
        <div className="flex-1 flex items-center justify-center p-2 md:p-4">
          <div className="w-full max-w-4xl">
            <Game
              attemptNumber={currentAttempt}
              maxAttempts={MAX_ATTEMPTS}
              onScoreChange={handleScoreChange}
              onGameOver={handleGameOver}
              onObstaclePassed={handleObstaclePassed}
              onStart={handleStart}
            />
          </div>
        </div>

        {/* Results */}
        {allDone && (
          <div className="px-4 pb-4">
            <div
              className="max-w-4xl mx-auto rounded-xl p-4 border text-center"
              style={{ background: "rgba(0,0,0,0.6)", borderColor: "#ffe814" }}
            >
              <h3
                className="text-xl font-bold mb-2"
                style={{
                  color: "#ffe814",
                  textShadow: "0 0 10px rgba(255,232,20,0.5)",
                }}
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
                className="text-2xl font-bold mb-3"
                style={{ color: "#ffe814" }}
              >
                Total: {totalScore}
              </div>
              <button
                onClick={handleBackToLobby}
                className="px-6 py-2 rounded-lg font-bold text-black transition-all hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #00f0ff, #b024ff)",
                }}
              >
                VIEW LEADERBOARD
              </button>
            </div>
          </div>
        )}

        <footer className="text-center py-2 text-xs text-gray-700 border-t border-cyan-500/10">
          Scores verified onchain on MegaETH
        </footer>
      </div>
    );
  }

  // --- LOBBY VIEW ---
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a1a]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <span
            className="text-xl font-bold tracking-wider"
            style={{
              color: "#00f0ff",
              textShadow: "0 0 10px rgba(0,240,255,0.5)",
            }}
          >
            FLUFFLE DASH
          </span>
          <span className="text-xs text-purple-400/60 hidden sm:inline">
            by MegaRally
          </span>
        </div>
        <WalletConnect />
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-2">
          <h1
            className="text-3xl md:text-5xl font-bold"
            style={{
              color: "#00f0ff",
              textShadow: "0 0 30px rgba(0,240,255,0.3)",
            }}
          >
            FLUFFLE DASH
          </h1>
          <p className="text-gray-500 text-sm">
            Onchain endless runner on MegaETH. Every obstacle recorded. Scores
            fully verifiable.
          </p>
        </div>

        {/* Tournament */}
        {tournamentData && tournamentData.id > 0 && (
          <div>
            <h2
              className="text-sm font-bold uppercase tracking-wider mb-3"
              style={{ color: "#b024ff" }}
            >
              Active Tournament
            </h2>
            <TournamentCard
              id={tournamentData.id}
              entryFee={tournamentData.entryFee}
              endTime={tournamentData.endTime}
              prizePool={tournamentData.prizePool}
              playerCount={leaderboard.length}
              ended={tournamentData.ended}
              isEntered={isEntered}
              onEnter={handleEnter}
              onPlay={handlePlay}
              entering={entering}
            />

            {!isConnected && (
              <p className="text-center text-gray-600 text-xs mt-2">
                Connect your wallet to enter
              </p>
            )}

            {isEntered && (
              <div className="mt-2 text-center">
                <p className="text-xs text-gray-500">
                  Attempts used: {contractAttemptsUsed}/{MAX_ATTEMPTS}
                  {contractAttemptsUsed > 0 && (
                    <span className="ml-2">
                      Total score:{" "}
                      <span style={{ color: "#ffe814" }}>
                        {Number(entry?.totalScore || 0)}
                      </span>
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {!tournamentData && (
          <div className="text-center py-8">
            <div className="text-gray-600">Loading tournaments...</div>
          </div>
        )}

        {/* Leaderboard */}
        <div>
          <h2
            className="text-sm font-bold uppercase tracking-wider mb-3"
            style={{ color: "#ffe814" }}
          >
            Leaderboard
          </h2>
          <Leaderboard entries={leaderboard} currentPlayer={address} />
        </div>

        {/* Practice mode */}
        <div className="border-t border-cyan-500/10 pt-4">
          <button
            onClick={() => {
              handleReset();
              setView("game");
            }}
            className="w-full py-3 rounded-lg font-bold text-sm border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/5 transition-colors"
          >
            PRACTICE MODE (no wallet needed)
          </button>
        </div>
      </div>

      <footer className="text-center py-3 text-xs text-gray-700 border-t border-cyan-500/10">
        Scores verified onchain on MegaETH &middot; Contract{" "}
        <span className="font-mono text-gray-600">0x6d32...bA5b</span>
      </footer>
    </div>
  );
}
