"use client";

import { useEffect, useState, useCallback } from "react";
import { createPublicClient, http } from "viem";
import { MEGARALLY_ADDRESS, MEGARALLY_ABI } from "@/lib/contract";
import { megaethTestnet } from "@/lib/chains";

const ATTEMPTS_PER_TICKET = 3;

export interface TicketEntry {
  player: string;
  ticket: number; // 1-indexed
  ticketScore: number; // sum of the 3 attempts in this ticket
  scores: number[]; // individual attempt scores for this ticket
}

const client = createPublicClient({
  chain: megaethTestnet,
  transport: http(),
});

export function useLeaderboard(tournamentId: number) {
  const [entries, setEntries] = useState<TicketEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    if (tournamentId <= 0) return;

    try {
      setIsLoading(true);

      // Step 1: Get all player addresses
      const players = await client.readContract({
        address: MEGARALLY_ADDRESS,
        abi: MEGARALLY_ABI,
        functionName: "getTournamentPlayers",
        args: [BigInt(tournamentId)],
      });

      if (!players || players.length === 0) {
        setEntries([]);
        setIsLoading(false);
        return;
      }

      // Step 2: Get entry for each player
      const newEntries: TicketEntry[] = [];

      for (const player of players) {
        const entry = await client.readContract({
          address: MEGARALLY_ADDRESS,
          abi: MEGARALLY_ABI,
          functionName: "getEntry",
          args: [BigInt(tournamentId), player],
        });

        const attemptsUsed = Number(entry.attemptsUsed);
        const ticketCount = Number(entry.tickets);
        const scores = entry.scores;

        // Step 3: Split into ticket groups
        for (let t = 0; t < ticketCount; t++) {
          const startIdx = t * ATTEMPTS_PER_TICKET;
          const ticketScores: number[] = [];

          for (let a = 0; a < ATTEMPTS_PER_TICKET; a++) {
            const idx = startIdx + a;
            if (idx < attemptsUsed) {
              ticketScores.push(Number(scores[idx]));
            }
          }

          if (ticketScores.length > 0) {
            newEntries.push({
              player,
              ticket: t + 1,
              ticketScore: ticketScores.reduce((a, b) => a + b, 0),
              scores: ticketScores,
            });
          }
        }
      }

      setEntries(newEntries);
    } catch (err) {
      console.error("[leaderboard] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return { entries, isLoading, refetch: fetchLeaderboard };
}
