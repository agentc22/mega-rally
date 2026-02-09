"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import dynamic from "next/dynamic";
import Game from "@/components/Game";
import HUD from "@/components/HUD";
import WalletConnect from "@/components/WalletConnect";
import TournamentCard from "@/components/TournamentCard";
import Leaderboard from "@/components/Leaderboard";

const GameDemo = dynamic(() => import("@/components/GameDemo"), { ssr: false });
import {
  useTournamentCount,
  useTournament,
  useEntry,
  useEnterTournament,
  useActiveTournamentId,
} from "@/hooks/useTournament";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useOperator } from "@/hooks/useGame";

const ATTEMPTS_PER_TICKET = 3;

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
  const activeTournamentId = useActiveTournamentId();
  const { data: tournamentCount } = useTournamentCount();
  const { data: tournament } = useTournament(activeTournamentId);
  const { data: entry, refetch: refetchEntry } =
    useEntry(activeTournamentId);
  const {
    entries: leaderboard,
    refetch: refetchLeaderboard,
  } = useLeaderboard(activeTournamentId);

  const enterTournament = useEnterTournament();
  const { startAttempt, obstaclePassed, crash } = useOperator();

  // Track entry state from contract
  const isEntered = entry ? entry.player !== "0x0000000000000000000000000000000000000000" : false;
  const contractAttemptsUsed = entry ? Number(entry.attemptsUsed) : 0;
  const tickets = entry ? Number(entry.tickets) : 1;
  const maxAttempts = tickets * ATTEMPTS_PER_TICKET;

  // Reset state when tournament changes
  const prevTournamentRef = useRef(activeTournamentId);
  useEffect(() => {
    if (activeTournamentId !== prevTournamentRef.current) {
      prevTournamentRef.current = activeTournamentId;
      syncedRef.current = false;
      setScores([]);
      setCurrentAttempt(0);
      setTotalScore(0);
      setAllDone(false);
    }
  }, [activeTournamentId]);

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
      if (contractAttemptsUsed >= maxAttempts) {
        setAllDone(true);
      }
    }
  }, [isEntered, contractAttemptsUsed, entry, maxAttempts]);

  const handleEnter = useCallback(async () => {
    if (!tournament) return;
    setEntering(true);
    try {
      await enterTournament(activeTournamentId, tournament[1]); // entryFee
      await refetchEntry();
      // If buying additional ticket, reset allDone so player can play again
      setAllDone(false);
      syncedRef.current = false; // re-sync from contract on next render
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
      startAttempt(activeTournamentId);
    }
  }, [address, startAttempt]);

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
      if (nextAttempt >= maxAttempts) {
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
        ended: tournament[6] as boolean,
      }
    : null;

  // --- GAME VIEW ---
  if (view === "game") {
    return (
      <div className="h-dvh flex flex-col bg-[#0a0a1a] overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-1 border-b border-cyan-500/20 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToLobby}
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
              FLUFFLE DASH
            </span>
          </div>
          <WalletConnect />
        </header>

        {/* HUD */}
        <div className="shrink-0">
          <HUD
            scores={scores}
            currentAttempt={currentAttempt}
            maxAttempts={maxAttempts}
            totalScore={totalScore}
          />
        </div>

        {/* Game */}
        <div className="flex-1 flex items-center justify-center p-1 md:p-4 min-h-0">
          <div className="w-full h-full max-w-4xl">
            <Game
              attemptNumber={currentAttempt}
              maxAttempts={maxAttempts}
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

        <footer className="text-center py-1 text-xs text-gray-700 border-t border-cyan-500/10 shrink-0">
          Scores verified onchain on MegaETH
        </footer>
      </div>
    );
  }

  // --- LOBBY VIEW ---
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 border-b border-cyan-500/20 bg-[#0a0a1a]/90 backdrop-blur-sm">
        <span
          className="text-lg font-bold tracking-wider"
          style={{
            color: "#00f0ff",
            textShadow: "0 0 10px rgba(0,240,255,0.5)",
          }}
        >
          FLUFFLE DASH
        </span>
        <WalletConnect />
      </header>

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-[70vh] md:min-h-[80vh] flex items-center justify-center overflow-hidden pt-14">
        {/* Demo game background */}
        <div className="absolute inset-0 opacity-40">
          <GameDemo />
        </div>
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a]/60 via-transparent to-[#0a0a1a]" />

        <div className="relative z-10 text-center px-4 space-y-6">
          <h1
            className="text-5xl sm:text-6xl md:text-8xl font-extrabold tracking-tight"
            style={{
              color: "#00f0ff",
              textShadow:
                "0 0 40px rgba(0,240,255,0.4), 0 0 80px rgba(0,240,255,0.2)",
            }}
          >
            FLUFFLE DASH
          </h1>
          <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
            The first real-time onchain endless runner on MegaETH
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {!isConnected ? (
              <button
                onClick={() => {
                  document.getElementById("tournament")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-8 py-3 rounded-lg font-bold text-black text-base transition-all hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #00f0ff, #b024ff)",
                }}
              >
                ENTER TOURNAMENT
              </button>
            ) : !isEntered ? (
              <button
                onClick={handleEnter}
                disabled={entering}
                className="px-8 py-3 rounded-lg font-bold text-black text-base transition-all hover:scale-105 disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #00f0ff, #b024ff)",
                }}
              >
                {entering ? "ENTERING..." : `ENTER TOURNAMENT (${tournamentData ? formatEther(tournamentData.entryFee) : "0.01"} ETH)`}
              </button>
            ) : contractAttemptsUsed < maxAttempts ? (
              <button
                onClick={() => setView("game")}
                className="px-8 py-3 rounded-lg font-bold text-black text-base transition-all hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #ffe814, #ff2d95)",
                }}
              >
                PLAY NOW
              </button>
            ) : (
              <button
                onClick={handleEnter}
                disabled={entering}
                className="px-8 py-3 rounded-lg font-bold text-black text-base transition-all hover:scale-105 disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #b024ff, #ff2d95)",
                }}
              >
                {entering ? "PURCHASING..." : "BUY ANOTHER TICKET (+3 ATTEMPTS)"}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ===== ACTIVE TOURNAMENT ===== */}
      <section
        id="tournament"
        className="py-12 md:py-16 px-4"
      >
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-sm font-bold uppercase tracking-widest text-center mb-8"
            style={{ color: "#b024ff" }}
          >
            Active Tournament
          </h2>

          {tournamentData && tournamentData.id > 0 ? (
            <div>
              <TournamentCard
                id={tournamentData.id}
                entryFee={tournamentData.entryFee}
                endTime={tournamentData.endTime}
                prizePool={tournamentData.prizePool}
                ticketCount={tournamentData.entryFee > 0n ? Number(tournamentData.prizePool / tournamentData.entryFee) : 0}
                ended={tournamentData.ended}
                isEntered={isEntered}
                onEnter={handleEnter}
                onPlay={handlePlay}
                entering={entering}
              />

              {!isConnected && (
                <p className="text-center text-gray-600 text-xs mt-3">
                  Connect your wallet to enter
                </p>
              )}

              {isEntered && (
                <div className="mt-3 text-center space-y-2">
                  <p className="text-xs text-gray-500">
                    Attempts: {contractAttemptsUsed}/{maxAttempts}
                    {tickets > 1 && (
                      <span className="ml-2 text-purple-400">
                        ({tickets} tickets)
                      </span>
                    )}
                    {contractAttemptsUsed > 0 && (
                      <span className="ml-2">
                        Total score:{" "}
                        <span style={{ color: "#ffe814" }}>
                          {Number(entry?.totalScore || 0)}
                        </span>
                      </span>
                    )}
                  </p>
                  {contractAttemptsUsed >= maxAttempts && !tournamentData?.ended && (
                    <button
                      onClick={handleEnter}
                      disabled={entering}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition-all disabled:opacity-50"
                    >
                      {entering ? "BUYING..." : "BUY ANOTHER TICKET (+3 ATTEMPTS)"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-600">Loading tournament...</div>
            </div>
          )}
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-16 md:py-24 px-4 border-t border-cyan-500/10">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-sm font-bold uppercase tracking-widest text-center mb-12"
            style={{ color: "#b024ff" }}
          >
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Connect",
                desc: "Connect your wallet and enter a tournament with a small ETH entry fee.",
              },
              {
                step: "02",
                title: "Play",
                desc: "Jump over obstacles and rack up points. Each ticket gives 3 attempts. Buy more for extra runs.",
              },
              {
                step: "03",
                title: "Win",
                desc: "Highest single-attempt score wins the prize pool (98%).",
              },
            ].map((item) => (
              <div key={item.step} className="text-center md:text-left">
                <div
                  className="text-4xl font-extrabold mb-2"
                  style={{
                    color: "#00f0ff",
                    textShadow: "0 0 15px rgba(0,240,255,0.3)",
                  }}
                >
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  {item.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES GRID ===== */}
      <section className="py-16 md:py-24 px-4 border-t border-cyan-500/10">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: "Real-Time Blockchain",
                desc: "Every obstacle, every score, verified on MegaETH in <10ms.",
                color: "#00f0ff",
              },
              {
                title: "Tournament Prizes",
                desc: "Entry fees pool together. Winner takes 98%.",
                color: "#ffe814",
              },
              {
                title: "Fully Onchain",
                desc: "No server trust. Operator relays, chain verifies.",
                color: "#b024ff",
              },
              {
                title: "Multiple Tickets",
                desc: "Buy extra tickets for more chances. Best single run counts.",
                color: "#ff2d95",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl p-5 border border-white/5 bg-white/[0.02]"
              >
                <h3
                  className="font-bold text-sm uppercase tracking-wider mb-1"
                  style={{ color: feature.color }}
                >
                  {feature.title}
                </h3>
                <p className="text-gray-500 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LEADERBOARD ===== */}
      <section className="py-16 md:py-24 px-4 border-t border-cyan-500/10">
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-sm font-bold uppercase tracking-widest text-center mb-8"
            style={{ color: "#ffe814" }}
          >
            Leaderboard
          </h2>
          <Leaderboard entries={leaderboard} currentPlayer={address} />
        </div>
      </section>

      {/* ===== PRACTICE MODE ===== */}
      <section className="py-16 px-4 border-t border-cyan-500/10">
        <div className="max-w-md mx-auto text-center">
          <p className="text-gray-500 text-sm mb-4">
            Want to try before you commit?
          </p>
          <button
            onClick={() => {
              handleReset();
              setView("game");
            }}
            className="px-8 py-3 rounded-lg font-bold text-sm border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all"
          >
            PRACTICE MODE — NO WALLET NEEDED
          </button>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-8 px-4 border-t border-cyan-500/10">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <a
                href="https://testnet.megaethscan.io/address/0xEF8481DAEb6e2bD8623eB414fb33f37d44DC54d7"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-cyan-400 transition-colors"
              >
                0xEF84...54d7
              </a>
              <span>Built on MegaETH</span>
            </div>
            <a
              href="https://github.com/agentc22/mega-rally"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors"
            >
              GitHub
            </a>
          </div>
          <p className="text-center text-[10px] text-gray-700 leading-relaxed max-w-lg mx-auto">
            Built by a human + Claude. This is an experimental project on testnet.
            Smart contracts are unaudited. Use at your own risk and never deposit funds you cannot afford to lose.
          </p>
        </div>
      </footer>
    </div>
  );
}
