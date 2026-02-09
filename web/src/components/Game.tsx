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
  const scoreRef = useRef<HTMLSpanElement>(null);
  const [gameState, setGameState] = useState<"idle" | "playing" | "dead">(
    "idle"
  );
  const [finalScore, setFinalScore] = useState(0);

  // Store callbacks in refs so engine never needs to be recreated
  const callbackRefs = useRef({ onGameOver, onScoreChange, onObstaclePassed });
  callbackRefs.current = { onGameOver, onScoreChange, onObstaclePassed };

  // Initialize engine — only depends on canvas mount, never recreated
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const callbacks: GameCallbacks = {
      onScoreChange: (newScore: number) => {
        // Direct DOM update — bypasses React entirely
        if (scoreRef.current) {
          scoreRef.current.textContent = String(newScore);
        }
        callbackRefs.current.onScoreChange(newScore);
      },
      onGameOver: (score: number) => {
        setFinalScore(score);
        setGameState("dead");
        callbackRefs.current.onGameOver(score);
      },
      onObstaclePassed: (id: number) => {
        callbackRefs.current.onObstaclePassed(id);
      },
    };

    const engine = new GameEngine(canvas, callbacks);
    engineRef.current = engine;

    const resize = () => {
      const container = canvas.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      let w: number, h: number;
      if (rect.height > rect.width) {
        // Portrait (mobile): fill the container
        w = rect.width;
        h = rect.height;
      } else {
        // Landscape / desktop: 16:9 aspect ratio
        w = rect.width;
        h = w * (9 / 16);
        if (h > rect.height) {
          h = rect.height;
          w = h * (16 / 9);
        }
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      engine.resize(Math.round(w), Math.round(h));
    };

    resize();
    window.addEventListener("resize", resize);
    engine.renderIdle();

    return () => {
      window.removeEventListener("resize", resize);
      engine.stop();
    };
  }, []);

  // Handle input
  const handleInput = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (gameState === "idle") {
      if (attemptNumber >= maxAttempts) return; // No attempts left
      setGameState("playing");
      if (scoreRef.current) scoreRef.current.textContent = "0";
      engine.start();
      onStart();
      setTimeout(() => engine.jump(), 50);
    } else if (gameState === "playing") {
      engine.jump();
    } else if (gameState === "dead") {
      if (attemptNumber < maxAttempts) {
        setGameState("playing");
        if (scoreRef.current) scoreRef.current.textContent = "0";
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
    <div className="relative w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        onClick={handleInput}
        onTouchStart={(e) => {
          e.preventDefault();
          handleInput();
        }}
        className="cursor-pointer block"
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
              {finalScore}
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

      {/* Score display during gameplay — updated via ref, no React re-renders */}
      {gameState === "playing" && (
        <div className="absolute top-4 right-4 pointer-events-none">
          <span
            ref={scoreRef}
            className="text-3xl md:text-5xl font-bold tabular-nums"
            style={{
              color: "#00f0ff",
              textShadow: "0 0 15px #00f0ff",
            }}
          >
            0
          </span>
        </div>
      )}
    </div>
  );
}
