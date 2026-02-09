type MessageHandler = (msg: Record<string, unknown>) => void;
type SignMessageFn = (args: { message: string }) => Promise<`0x${string}`>;

export class OperatorClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private authenticated = false;
  private address: string | null = null;
  private signMessage: SignMessageFn | null = null;

  // Exponential backoff state
  private reconnectAttempts = 0;
  private readonly maxReconnectDelay = 30000;
  private readonly baseReconnectDelay = 1000;
  private readonly maxReconnectAttempts = 20;

  constructor(url: string = "ws://localhost:8080") {
    this.url = url;
  }

  setAuth(address: string, signMessage: SignMessageFn) {
    this.address = address;
    this.signMessage = signMessage;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("[operator] connected");
      this.connected = true;
      this.reconnectAttempts = 0; // Reset backoff on successful connect
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Handle auth challenge from server
        if (msg.type === "AUTH_CHALLENGE") {
          this.handleAuthChallenge(msg.nonce);
          return;
        }

        if (msg.type === "AUTH_OK") {
          this.authenticated = true;
          console.log("[operator] authenticated");
        }

        if (msg.type === "AUTH_FAILED") {
          console.error("[operator] auth failed:", msg.message);
          this.authenticated = false;
        }

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
      this.authenticated = false;

      // Exponential backoff with jitter
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(
          this.maxReconnectDelay,
          this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts)
        );
        const jitter = delay * (0.5 + Math.random() * 0.5);
        this.reconnectAttempts++;
        console.log(
          `[operator] reconnecting in ${Math.round(jitter)}ms (attempt ${this.reconnectAttempts})`
        );
        this.reconnectTimer = setTimeout(() => this.connect(), jitter);
      } else {
        console.error(
          "[operator] max reconnect attempts reached, giving up"
        );
      }
    };

    this.ws.onerror = (err) => {
      console.error("[operator] error:", err);
    };
  }

  private async handleAuthChallenge(nonce: string) {
    if (!this.address || !this.signMessage) {
      console.warn("[operator] no wallet set, cannot authenticate");
      return;
    }

    try {
      const message = `MegaRally auth: ${nonce}`;
      const signature = await this.signMessage({ message });
      this.send({ type: "AUTH", address: this.address, signature });
    } catch (err) {
      console.error("[operator] failed to sign auth:", err);
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.authenticated = false;
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

  startAttempt(tournamentId: number) {
    this.send({ type: "START_ATTEMPT", tournamentId });
  }

  obstaclePassed(obstacleId: number) {
    this.send({ type: "OBSTACLE_PASSED", obstacleId });
  }

  crash() {
    // No score sent — server computes it
    this.send({ type: "CRASH" });
  }

  isConnected(): boolean {
    return this.connected;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }
}
