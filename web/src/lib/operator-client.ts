type MessageHandler = (msg: Record<string, unknown>) => void;

export class OperatorClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;

  constructor(url: string = "ws://localhost:8080") {
    this.url = url;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("[operator] connected");
      this.connected = true;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const handlers = this.handlers.get(msg.type) || [];
        for (const handler of handlers) {
          handler(msg);
        }
      } catch (err) {
        console.error("[operator] message parse error:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("[operator] disconnected");
      this.connected = false;
      // Reconnect after 2s
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };

    this.ws.onerror = (err) => {
      console.error("[operator] error:", err);
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  send(msg: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn("[operator] not connected, message dropped");
    }
  }

  startAttempt(tournamentId: number, player: string) {
    this.send({ type: "START_ATTEMPT", tournamentId, player });
  }

  obstaclePassed(player: string, obstacleId: number) {
    this.send({ type: "OBSTACLE_PASSED", player, obstacleId });
  }

  crash(player: string, score: number) {
    this.send({ type: "CRASH", player, score });
  }

  isConnected(): boolean {
    return this.connected;
  }
}
