"use client";

import {
  useReadContract,
  useWriteContract,
  useAccount,
  useSwitchChain,
} from "wagmi";
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
