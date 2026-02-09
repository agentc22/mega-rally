"use client";

import { useEffect, useState, useCallback } from "react";
import { createPublicClient, http, formatEther } from "viem";
import { MEGARALLY_ADDRESS, MEGARALLY_ABI } from "@/lib/contract";
import { megaethTestnet } from "@/lib/chains";

const ATTEMPTS_PER_TICKET = 3;

const client = createPublicClient({
  chain: megaethTestnet,
  transport: http(),
});

export interface TournamentHistoryEntry {
  tournamentId: number;
  entryFee: bigint;
  endTime: bigint;
  prizePool: bigint;
  ended: boolean;
  cancelled: boolean;
  winner: string;
  // Player's entry data
  scores: number[];
  attemptsUsed: number;
  tickets: number;
  totalScore: number;
  bestScore: number;
}

export function usePlayerHistory(address: string | undefined) {
  const [history, setHistory] = useState<TournamentHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!address) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const count = await client.readContract({
        address: MEGARALLY_ADDRESS,
        abi: MEGARALLY_ABI,
        functionName: "tournamentCount",
      });

      const total = Number(count);
      if (total === 0) {
        setHistory([]);
        setIsLoading(false);
        return;
      }

      const entries: TournamentHistoryEntry[] = [];

      for (let i = 1; i <= total; i++) {
        const entry = await client.readContract({
          address: MEGARALLY_ADDRESS,
          abi: MEGARALLY_ABI,
          functionName: "getEntry",
          args: [BigInt(i), address as `0x${string}`],
        });

        // Skip tournaments the player didn't enter
        if (entry.player === "0x0000000000000000000000000000000000000000") {
          continue;
        }

        const tournament = await client.readContract({
          address: MEGARALLY_ADDRESS,
          abi: MEGARALLY_ABI,
          functionName: "tournaments",
          args: [BigInt(i)],
        });

        entries.push({
          tournamentId: i,
          entryFee: tournament[1],
          endTime: tournament[3],
          prizePool: tournament[4],
          ended: tournament[6],
          cancelled: tournament[7],
          winner: tournament[8],
          scores: entry.scores.map((s) => Number(s)),
          attemptsUsed: Number(entry.attemptsUsed),
          tickets: Number(entry.tickets),
          totalScore: Number(entry.totalScore),
          bestScore: Number(entry.bestScore),
        });
      }

      // Newest first
      entries.reverse();
      setHistory(entries);
    } catch (err) {
      console.error("[player-history] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, isLoading, refetch: fetchHistory };
}
