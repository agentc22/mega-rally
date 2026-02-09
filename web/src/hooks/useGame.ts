"use client";

import { useRef, useCallback, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { OperatorClient } from "@/lib/operator-client";

export function useOperator() {
  const clientRef = useRef<OperatorClient | null>(null);
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // Keep signMessageAsync in a ref so it doesn't cause reconnects
  const signRef = useRef(signMessageAsync);
  signRef.current = signMessageAsync;

  useEffect(() => {
    const client = new OperatorClient(
      process.env.NEXT_PUBLIC_OPERATOR_URL || "wss://operator-production-4127.up.railway.app"
    );

    // Set auth credentials if wallet is connected
    if (address) {
      client.setAuth(address, (args) => signRef.current(args));
    }

    client.connect();
    clientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, [address]);

  const startAttempt = useCallback(
    (tournamentId: number) => {
      clientRef.current?.startAttempt(tournamentId);
    },
    []
  );

  const obstaclePassed = useCallback(
    (obstacleId: number) => {
      clientRef.current?.obstaclePassed(obstacleId);
    },
    []
  );

  const crash = useCallback(() => {
    clientRef.current?.crash();
  }, []);

  return { startAttempt, obstaclePassed, crash };
}
