"use client";

import { useReadContract, useWriteContract, useAccount, useSwitchChain } from "wagmi";
import { MEGARALLY_ADDRESS, MEGARALLY_ABI } from "@/lib/contract";
import { megaethTestnet } from "@/lib/chains";

export function usePendingWithdrawal(address: string | undefined) {
  return useReadContract({
    address: MEGARALLY_ADDRESS,
    abi: MEGARALLY_ABI,
    functionName: "pendingWithdrawals",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });
}

export function useWithdraw() {
  const { writeContractAsync } = useWriteContract();
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  return async () => {
    if (!isConnected) {
      throw new Error("Wallet not connected");
    }

    if (chainId !== megaethTestnet.id) {
      await switchChainAsync({ chainId: megaethTestnet.id });
    }

    return writeContractAsync({
      address: MEGARALLY_ADDRESS,
      abi: MEGARALLY_ABI,
      functionName: "withdraw",
      gas: 500000n,
      chainId: megaethTestnet.id,
    });
  };
}
