"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import Link from "next/link";
import { megaethTestnet } from "@/lib/chains";

export default function WalletConnect() {
  const { address, isConnected, chainId } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const wrongChain = isConnected && chainId !== megaethTestnet.id;

  if (!mounted) {
    return <div className="h-8" />;
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {wrongChain && (
          <button
            onClick={() => switchChain({ chainId: megaethTestnet.id })}
            className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
          >
            Switch to MegaETH
          </button>
        )}
        <Link
          href={`/profile/${address}`}
          className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono hover:text-cyan-300 transition-colors"
          title="View profile"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {address.slice(0, 6)}...{address.slice(-4)}
        </Link>
        <button
          onClick={() => disconnect()}
          className="text-xs px-2 py-1 rounded border border-pink-500/40 text-pink-400 hover:bg-pink-500/10 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        const connector = connectors.find((c) => c.type === "injected") ?? connectors[0];
        if (connector) connect({ connector, chainId: megaethTestnet.id });
      }}
      className="px-3 py-1.5 rounded-lg text-sm font-bold text-black transition-all hover:scale-105"
      style={{
        background: "linear-gradient(135deg, #00f0ff, #b024ff)",
      }}
    >
      Connect Wallet
    </button>
  );
}
