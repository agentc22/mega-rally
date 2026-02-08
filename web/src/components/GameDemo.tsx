"use client";

import { useRef, useEffect } from "react";
import { GameEngine } from "@/lib/game-engine";

export default function GameDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Dummy callbacks — demo mode doesn't use them
    const noop = () => {};
    const engine = new GameEngine(canvas, {
      onScoreChange: noop,
      onGameOver: noop,
      onObstaclePassed: noop,
    });
    engineRef.current = engine;

    const resize = () => {
      const container = canvas.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      engine.resize(Math.round(rect.width), Math.round(rect.height));
    };

    resize();
    window.addEventListener("resize", resize);
    engine.startDemo();

    return () => {
      window.removeEventListener("resize", resize);
      engine.stopDemo();
      engine.stop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}
