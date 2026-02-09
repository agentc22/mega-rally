"use client";

import { useRef, useCallback, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { OperatorClient } from "@/lib/operator-client";

export function useOperator() {
  const clientRef = useRef<OperatorClient | null>(null);
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    const client = new OperatorClient(
      process.env.NEXT_PUBLIC_OPERATOR_URL || "ws://localhost:8080"
    );

    // Set auth credentials if wallet is connected
    if (address) {
      client.setAuth(address, signMessageAsync);
    }

    client.connect();
    clientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, [address, signMessageAsync]);

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
