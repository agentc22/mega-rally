"use client";

import { useRef, useCallback, useEffect } from "react";
import { OperatorClient } from "@/lib/operator-client";

export function useOperator() {
  const clientRef = useRef<OperatorClient | null>(null);

  useEffect(() => {
    const client = new OperatorClient(
      process.env.NEXT_PUBLIC_OPERATOR_URL || "ws://localhost:8080"
    );
    client.connect();
    clientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, []);

  const startAttempt = useCallback(
    (tournamentId: number, player: string) => {
      clientRef.current?.startAttempt(tournamentId, player);
    },
    []
  );

  const obstaclePassed = useCallback(
    (player: string, obstacleId: number) => {
      clientRef.current?.obstaclePassed(player, obstacleId);
    },
    []
  );

  const crash = useCallback((player: string, score: number) => {
    clientRef.current?.crash(player, score);
  }, []);

  return { startAttempt, obstaclePassed, crash };
}
