"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useReconnect,
} from "wagmi";
import Link from "next/link";
import { megaethTestnet } from "@/lib/chains";

export default function WalletConnect() {
  const { address, isConnected, chainId, connector } = useAccount();
  const [mounted, setMounted] = useState(false);
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { reconnect } = useReconnect();

  useEffect(() => {
    setMounted(true);
    console.log("[wallet-v2] mounted, isConnected:", isConnected, "address:", address);
  }, []);

  // Detect stale connection: wagmi thinks connected but provider gone
  useEffect(() => {
    if (!mounted || !isConnected || !connector) return;
    connector.getProvider().then((provider) => {
      if (!provider) {
        console.warn("[wallet-v2] stale connection detected, disconnecting");
        disconnect();
      }
    }).catch(() => {
      console.warn("[wallet-v2] provider check failed, disconnecting");
      disconnect();
    });
  }, [mounted, isConnected, connector, disconnect]);

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
          onClick={() => {
            disconnect();
            console.log("[wallet-v2] disconnected");
          }}
          className="text-xs px-2 py-1 rounded border border-pink-500/40 text-pink-400 hover:bg-pink-500/10 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          console.log("[wallet-v2] connect clicked");
          console.log("[wallet-v2] connectors:", connectors.map((c) => ({ name: c.name, type: c.type, uid: c.uid })));
          console.log("[wallet-v2] window.ethereum:", !!(window as any).ethereum);

          // Try reconnecting first (restores previous session)
          reconnect();

          const connector =
            connectors.find((c) => c.type === "injected") ?? connectors[0];
          if (connector) {
            console.log("[wallet-v2] connecting with:", connector.name);
            connect(
              { connector, chainId: megaethTestnet.id },
              {
                onError: (err) =>
                  console.error("[wallet-v2] connect error:", err),
                onSuccess: (data) =>
                  console.log("[wallet-v2] connected:", data),
              }
            );
          } else {
            console.error("[wallet-v2] no connectors available");
          }
        }}
        className="px-3 py-1.5 rounded-lg text-sm font-bold text-black transition-all hover:scale-105"
        style={{
          background: "linear-gradient(135deg, #00f0ff, #b024ff)",
        }}
      >
        Connect Wallet
      </button>
      {connectError && (
        <span
          className="text-xs text-red-400 max-w-[200px] truncate"
          title={connectError.message}
        >
          {connectError.message}
        </span>
      )}
    </div>
  );
}
