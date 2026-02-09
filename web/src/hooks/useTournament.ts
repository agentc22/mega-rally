"use client";

import { useEffect, useState, useCallback } from "react";
import {
  useReadContract,
  useWriteContract,
  useAccount,
  useSwitchChain,
} from "wagmi";
import { createPublicClient, http } from "viem";
import { MEGARALLY_ADDRESS, MEGARALLY_ABI } from "@/lib/contract";
import { megaethTestnet } from "@/lib/chains";

export function useTournamentCount() {
  return useReadContract({
    address: MEGARALLY_ADDRESS,
    abi: MEGARALLY_ABI,
    functionName: "tournamentCount",
  });
}

export function useTournament(id: number) {
  return useReadContract({
    address: MEGARALLY_ADDRESS,
    abi: MEGARALLY_ABI,
    functionName: "tournaments",
    args: [BigInt(id)],
  });
}

export function useEntry(tournamentId: number) {
  const { address } = useAccount();
  return useReadContract({
    address: MEGARALLY_ADDRESS,
    abi: MEGARALLY_ABI,
    functionName: "getEntry",
    args: address ? [BigInt(tournamentId), address] : undefined,
    query: { enabled: !!address },
  });
}

export function useActiveTournamentId() {
  const { data: count } = useTournamentCount();
  const [activeId, setActiveId] = useState<number>(0);

  const findActive = useCallback(async () => {
    if (!count || count === 0n) return;

    const client = createPublicClient({
      chain: megaethTestnet,
      transport: http(),
    });

    const total = Number(count);
    const now = BigInt(Math.floor(Date.now() / 1000));

    // Check from newest to oldest
    for (let i = total; i >= 1; i--) {
      const t = await client.readContract({
        address: MEGARALLY_ADDRESS,
        abi: MEGARALLY_ABI,
        functionName: "tournaments",
        args: [BigInt(i)],
      });
      // Not ended and not expired
      if (!t[6] && now < (t[3] as bigint)) {
        setActiveId(i);
        return;
      }
    }
    // If no active tournament, show the latest one
    setActiveId(total);
  }, [count]);

  useEffect(() => {
    findActive();
    const interval = setInterval(findActive, 15000);
    return () => clearInterval(interval);
  }, [findActive]);

  return activeId;
}

export function useEnterTournament() {
  const { writeContractAsync } = useWriteContract();
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  return async (tournamentId: number, entryFee: bigint) => {
    if (!isConnected) {
      throw new Error("Wallet not connected");
    }

    // Switch to MegaETH testnet if on wrong chain
    if (chainId !== megaethTestnet.id) {
      await switchChainAsync({ chainId: megaethTestnet.id });
    }

    return writeContractAsync({
      address: MEGARALLY_ADDRESS,
      abi: MEGARALLY_ABI,
      functionName: "enter",
      args: [BigInt(tournamentId)],
      value: entryFee,
      gas: 1000000n,
      chainId: megaethTestnet.id,
    });
  };
}
