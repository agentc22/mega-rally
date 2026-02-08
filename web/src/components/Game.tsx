"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { GameEngine, GameCallbacks } from "@/lib/game-engine";

interface GameProps {
  attemptNumber: number;
  maxAttempts: number;
  onScoreChange: (score: number) => void;
  onGameOver: (score: number) => void;
  onObstaclePassed: (obstacleId: number) => void;
  onStart: () => void;
}

export default function Game({
  attemptNumber,
  maxAttempts,
  onScoreChange,
  onGameOver,
  onObstaclePassed,
  onStart,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<"idle" | "playing" | "dead">(
    "idle"
  );
  const [score, setScore] = useState(0);

  const handleGameOver = useCallback(
    (finalScore: number) => {
      setGameState("dead");
      onGameOver(finalScore);
    },
    [onGameOver]
  );

  const handleScoreChange = useCallback(
    (newScore: number) => {
      setScore(newScore);
      onScoreChange(newScore);
    },
    [onScoreChange]
  );

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const callbacks: GameCallbacks = {
      onScoreChange: handleScoreChange,
      onGameOver: handleGameOver,
      onObstaclePassed,
    };

    const engine = new GameEngine(canvas, callbacks);
    engineRef.current = engine;

    // Initial sizing
    const resize = () => {
      const container = canvas.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      // 16:9 aspect ratio
      let w = rect.width;
      let h = w * (9 / 16);
      if (h > rect.height) {
        h = rect.height;
        w = h * (16 / 9);
      }
      engine.resize(w, h);
      if (gameState === "idle") {
        engine.renderIdle();
      }
    };

    resize();
    window.addEventListener("resize", resize);
    engine.renderIdle();

    return () => {
      window.removeEventListener("resize", resize);
      engine.stop();
    };
  }, [handleGameOver, handleScoreChange, onObstaclePassed]);

  // Handle input
  const handleInput = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (gameState === "idle") {
      setGameState("playing");
      setScore(0);
      engine.start();
      onStart();
      // Jump on first tap too
      setTimeout(() => engine.jump(), 50);
    } else if (gameState === "playing") {
      engine.jump();
    } else if (gameState === "dead") {
      if (attemptNumber < maxAttempts) {
        setGameState("playing");
        setScore(0);
        engine.start();
        onStart();
        setTimeout(() => engine.jump(), 50);
      }
    }
  }, [gameState, attemptNumber, maxAttempts, onStart]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        handleInput();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleInput]);

  return (
    <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
      <canvas
        ref={canvasRef}
        onClick={handleInput}
        onTouchStart={(e) => {
          e.preventDefault();
          handleInput();
        }}
        className="w-full h-full cursor-pointer block"
        style={{ touchAction: "none" }}
      />

      {/* Overlay messages */}
      {gameState === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <h1
            className="text-4xl md:text-6xl font-bold mb-4"
            style={{
              color: "#00f0ff",
              textShadow: "0 0 20px #00f0ff, 0 0 40px #00f0ff",
            }}
          >
            FLUFFLE DASH
          </h1>
          <p
            className="text-lg md:text-xl animate-pulse"
            style={{ color: "#ff2d95" }}
          >
            TAP TO START
          </p>
        </div>
      )}

      {gameState === "dead" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div
            className="bg-black/80 border rounded-xl p-6 md:p-8 text-center"
            style={{ borderColor: "#ff2d95" }}
          >
            <h2
              className="text-2xl md:text-4xl font-bold mb-2"
              style={{
                color: "#ff2d95",
                textShadow: "0 0 15px #ff2d95",
              }}
            >
              CRASHED!
            </h2>
            <p
              className="text-3xl md:text-5xl font-bold mb-4"
              style={{
                color: "#00f0ff",
                textShadow: "0 0 15px #00f0ff",
              }}
            >
              {score}
            </p>
            {attemptNumber < maxAttempts ? (
              <p
                className="text-base md:text-lg animate-pulse"
                style={{ color: "#ffe814" }}
              >
                TAP TO RETRY ({maxAttempts - attemptNumber} left)
              </p>
            ) : (
              <p className="text-base md:text-lg" style={{ color: "#b024ff" }}>
                NO ATTEMPTS LEFT
              </p>
            )}
          </div>
        </div>
      )}

      {/* Score display during gameplay */}
      {gameState === "playing" && (
        <div className="absolute top-4 right-4 pointer-events-none">
          <span
            className="text-3xl md:text-5xl font-bold tabular-nums"
            style={{
              color: "#00f0ff",
              textShadow: "0 0 15px #00f0ff",
            }}
          >
            {score}
          </span>
        </div>
      )}
    </div>
  );
}
