"use client";

import { useReadContract } from "wagmi";
import { MEGARALLY_ADDRESS, MEGARALLY_ABI } from "@/lib/contract";

export function useLeaderboard(tournamentId: number) {
  const { data, isLoading, refetch } = useReadContract({
    address: MEGARALLY_ADDRESS,
    abi: MEGARALLY_ABI,
    functionName: "getLeaderboard",
    args: [BigInt(tournamentId)],
  });

  const entries =
    data
      ? (data[0] as readonly `0x${string}`[]).map(
          (player: `0x${string}`, i: number) => ({
            player,
            score: (data[1] as readonly bigint[])[i],
          })
        )
      : [];

  return { entries, isLoading, refetch };
}
