import "dotenv/config";
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  verifyMessage,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { WebSocketServer } from "ws";
import crypto from "crypto";

const MEGARALLY_ADDRESS =
  process.env.CONTRACT_ADDRESS || "0x6E3b0923c176cfAa3A534b7610534Aca12084f3B";

const MEGARALLY_ABI = [
  {
    type: "function",
    name: "startAttempt",
    inputs: [
      { name: "_tournamentId", type: "uint256" },
      { name: "_player", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordObstacle",
    inputs: [
      { name: "_tournamentId", type: "uint256" },
      { name: "_player", type: "address" },
      { name: "_obstacleId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordAttemptEnd",
    inputs: [
      { name: "_tournamentId", type: "uint256" },
      { name: "_player", type: "address" },
      { name: "_score", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getEntry",
    inputs: [
      { name: "_tournamentId", type: "uint256" },
      { name: "_player", type: "address" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "player", type: "address" },
          { name: "tournamentId", type: "uint256" },
          { name: "scores", type: "uint256[]" },
          { name: "attemptsUsed", type: "uint8" },
          { name: "tickets", type: "uint8" },
          { name: "totalScore", type: "uint256" },
          { name: "bestScore", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tournaments",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "entryFee", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "prizePool", type: "uint256" },
      { name: "paidOut", type: "uint256" },
      { name: "ended", type: "bool" },
      { name: "cancelled", type: "bool" },
      { name: "winner", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tournamentCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "endTournament",
    inputs: [{ name: "_tournamentId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "pendingWithdrawals",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

const RPC_URL = process.env.RPC_URL || "https://carrot.megaeth.com/rpc";

const megaethTestnet = defineChain({
  id: Number(process.env.CHAIN_ID || 6343),
  name: "MegaETH Testnet",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

const OPERATOR_KEY = process.env.OPERATOR_PRIVATE_KEY;
if (!OPERATOR_KEY) {
  console.error("OPERATOR_PRIVATE_KEY env var required");
  process.exit(1);
}

const account = privateKeyToAccount(OPERATOR_KEY);

const walletClient = createWalletClient({
  account,
  chain: megaethTestnet,
  transport: http(RPC_URL),
});

const publicClient = createPublicClient({
  chain: megaethTestnet,
  transport: http(RPC_URL),
});

// --- Scoring constants (must match game-engine.ts) ---
const OBSTACLE_BONUS = 25;
const OBSTACLE_SPEED_START = 6;
const OBSTACLE_SPEED_INCREMENT = 0.0008;
const DISTANCE_SCORE_RATE = 0.15;
const FRAME_INTERVAL_MS = 16; // ~60fps
const MAX_GAME_DURATION_MS = 5 * 60 * 1000; // 5 minutes max per attempt
const MIN_OBSTACLE_INTERVAL_MS = 200; // Fastest possible obstacle gap based on game physics

// Track active games: playerId -> { tournamentId, obstacles, obstacleIds, ws, startTime, lastObstacleTime }
const activeGames = new Map();

// Track authenticated connections: ws -> { address, nonce }
const authenticatedClients = new Map();

// Rate limiting: address -> { lastAction, actionCount }
const rateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_ACTIONS = 10;

// TX queue to prevent nonce conflicts (with timeout to prevent deadlock)
const TX_TIMEOUT_MS = 30000;
let txQueue = Promise.resolve();
function queueTx(fn) {
  txQueue = txQueue.then(() => {
    return Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("TX timeout")), TX_TIMEOUT_MS)),
    ]);
  }).catch((err) => {
    console.error("TX failed:", err.message);
  });
  return txQueue;
}

function checkRateLimit(address) {
  const now = Date.now();
  const limit = rateLimits.get(address);
  if (!limit || now - limit.lastAction > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(address, { lastAction: now, actionCount: 1 });
    return true;
  }
  limit.actionCount++;
  if (limit.actionCount > RATE_LIMIT_MAX_ACTIONS) {
    return false;
  }
  return true;
}

// Compute score server-side from obstacle count and elapsed time
function computeScore(obstacleCount, elapsedMs) {
  // Cap elapsed time to prevent unbounded score accumulation
  const cappedMs = Math.min(elapsedMs, MAX_GAME_DURATION_MS);
  const frames = Math.floor(cappedMs / FRAME_INTERVAL_MS);
  let distanceScore = 0;
  for (let f = 0; f < frames; f++) {
    const speed = Math.min(14, OBSTACLE_SPEED_START + f * OBSTACLE_SPEED_INCREMENT);
    distanceScore += DISTANCE_SCORE_RATE * (speed / OBSTACLE_SPEED_START);
  }
  const obstacleScore = obstacleCount * OBSTACLE_BONUS;
  return Math.floor(distanceScore + obstacleScore);
}

const PORT = process.env.PORT || 8080;
const MAX_CONNECTIONS = 200;
const MAX_CONNECTIONS_PER_IP = 5;
const ipConnections = new Map();

const wss = new WebSocketServer({
  port: PORT,
  maxPayload: 1024, // 1KB max message size
});

wss.on("connection", (ws, req) => {
  // Enforce global connection limit
  if (wss.clients.size > MAX_CONNECTIONS) {
    ws.close(1013, "Server full");
    return;
  }

  // Per-IP connection limit
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
  const ipCount = ipConnections.get(ip) || 0;
  if (ipCount >= MAX_CONNECTIONS_PER_IP) {
    ws.close(1013, "Too many connections");
    return;
  }
  ipConnections.set(ip, ipCount + 1);
  ws.on("close", () => {
    const c = ipConnections.get(ip) || 1;
    if (c <= 1) ipConnections.delete(ip);
    else ipConnections.set(ip, c - 1);
  });

  console.log("Client connected");

  // Send auth challenge
  const nonce = crypto.randomBytes(16).toString("hex");
  ws.send(JSON.stringify({ type: "AUTH_CHALLENGE", nonce }));
  // Temporarily store nonce on the ws object until auth completes
  ws._pendingNonce = nonce;

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // --- AUTH message: must be first ---
      if (msg.type === "AUTH") {
        await handleAuth(ws, msg);
        return;
      }

      // All other messages require authentication
      const session = authenticatedClients.get(ws);
      if (!session) {
        ws.send(
          JSON.stringify({ type: "ERROR", message: "Not authenticated" })
        );
        return;
      }

      const player = session.address;

      // Rate limit check
      if (!checkRateLimit(player)) {
        ws.send(
          JSON.stringify({ type: "ERROR", message: "Rate limited" })
        );
        return;
      }

      switch (msg.type) {
        case "START_ATTEMPT":
          await handleStartAttempt(msg.tournamentId, player, ws);
          break;

        case "OBSTACLE_PASSED":
          await handleObstaclePassed(player, msg.obstacleId);
          break;

        case "CRASH":
          await handleCrash(player);
          break;

        default:
          ws.send(
            JSON.stringify({ type: "ERROR", message: "Unknown type" })
          );
      }
    } catch (err) {
      console.error("Message error:", err);
      ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    const session = authenticatedClients.get(ws);
    if (session) {
      activeGames.delete(session.address);
      rateLimits.delete(session.address);
      authenticatedClients.delete(ws);
    }
  });
});

async function handleAuth(ws, msg) {
  const { address, signature } = msg;
  const nonce = ws._pendingNonce;

  if (!nonce) {
    ws.send(
      JSON.stringify({ type: "AUTH_FAILED", message: "No pending challenge" })
    );
    return;
  }

  if (!address || !signature || !isAddress(address)) {
    ws.send(
      JSON.stringify({ type: "AUTH_FAILED", message: "Invalid auth data" })
    );
    return;
  }

  try {
    const message = `MegaRally auth: ${nonce}`;
    const valid = await verifyMessage({ address, message, signature });

    if (!valid) {
      ws.send(
        JSON.stringify({ type: "AUTH_FAILED", message: "Invalid signature" })
      );
      return;
    }

    delete ws._pendingNonce;
    authenticatedClients.set(ws, { address: address.toLowerCase() });
    ws.send(JSON.stringify({ type: "AUTH_OK", address }));
    console.log("Authenticated:", address.slice(0, 10));
  } catch (err) {
    ws.send(
      JSON.stringify({ type: "AUTH_FAILED", message: "Verification failed" })
    );
  }
}

// --- Fix 4: Preflight validation ---
async function validatePlayerState(tournamentId, player) {
  try {
    // Check tournament exists and is active
    const tournament = await publicClient.readContract({
      address: MEGARALLY_ADDRESS,
      abi: MEGARALLY_ABI,
      functionName: "tournaments",
      args: [BigInt(tournamentId)],
    });

    if (tournament[0] === 0n) {
      return { ok: false, reason: "Tournament doesn't exist" };
    }
    if (tournament[6]) {
      return { ok: false, reason: "Tournament ended" };
    }
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now >= tournament[3]) {
      return { ok: false, reason: "Tournament expired" };
    }

    // Check player is entered and has attempts left
    const entry = await publicClient.readContract({
      address: MEGARALLY_ADDRESS,
      abi: MEGARALLY_ABI,
      functionName: "getEntry",
      args: [BigInt(tournamentId), player],
    });

    if (entry.player === "0x0000000000000000000000000000000000000000") {
      return { ok: false, reason: "Not entered in tournament" };
    }
    const maxAttempts = Number(entry.tickets) * 3;
    if (Number(entry.attemptsUsed) >= maxAttempts) {
      return { ok: false, reason: "No attempts left" };
    }

    return { ok: true };
  } catch (err) {
    console.error("Preflight check failed:", err.message);
    return { ok: false, reason: "Preflight check failed" };
  }
}

async function handleStartAttempt(tournamentId, player, ws) {
  // Prevent overwriting an active game
  if (activeGames.has(player)) {
    ws.send(
      JSON.stringify({ type: "ERROR", message: "Game already in progress" })
    );
    return;
  }

  // Preflight validation
  const check = await validatePlayerState(tournamentId, player);
  if (!check.ok) {
    ws.send(
      JSON.stringify({ type: "ERROR", message: check.reason })
    );
    return;
  }

  activeGames.set(player, {
    tournamentId,
    obstacles: [],
    obstacleIds: new Set(),
    ws,
    startTime: Date.now(),
    lastObstacleTime: 0,
  });

  queueTx(async () => {
    const hash = await walletClient.writeContract({
      address: MEGARALLY_ADDRESS,
      abi: MEGARALLY_ABI,
      functionName: "startAttempt",
      args: [BigInt(tournamentId), player],
      gas: 500000n,
    });
    console.log("startAttempt tx:", hash);
    ws.send(JSON.stringify({ type: "ATTEMPT_STARTED", txHash: hash }));
  });
}

async function handleObstaclePassed(player, obstacleId) {
  const game = activeGames.get(player);
  if (!game) return;

  // Check game hasn't exceeded max duration
  if (Date.now() - game.startTime > MAX_GAME_DURATION_MS) {
    return;
  }

  // Validate obstacleId is a positive integer
  if (!Number.isInteger(obstacleId) || obstacleId <= 0) return;

  // Dedup: ignore duplicate obstacle IDs
  if (game.obstacleIds.has(obstacleId)) return;

  // Rate limit: enforce minimum interval between obstacles
  const now = Date.now();
  if (game.lastObstacleTime && now - game.lastObstacleTime < MIN_OBSTACLE_INTERVAL_MS) {
    return; // Too fast — silently drop
  }

  game.obstacleIds.add(obstacleId);
  game.obstacles.push(obstacleId);
  game.lastObstacleTime = now;

  queueTx(async () => {
    const hash = await walletClient.writeContract({
      address: MEGARALLY_ADDRESS,
      abi: MEGARALLY_ABI,
      functionName: "recordObstacle",
      args: [BigInt(game.tournamentId), player, BigInt(obstacleId)],
      gas: 500000n,
    });
    console.log("recordObstacle tx:", hash, "obstacle:", obstacleId);
  });
}

// Server-side score — ignore client score entirely
async function handleCrash(player) {
  const game = activeGames.get(player);
  if (!game) return;

  const elapsedMs = Date.now() - game.startTime;
  const score = computeScore(game.obstacles.length, elapsedMs);
  activeGames.delete(player);

  queueTx(async () => {
    try {
      const hash = await walletClient.writeContract({
        address: MEGARALLY_ADDRESS,
        abi: MEGARALLY_ABI,
        functionName: "recordAttemptEnd",
        args: [BigInt(game.tournamentId), player, BigInt(score)],
        gas: 500000n,
      });
      console.log("recordAttemptEnd tx:", hash, "score:", score);
      game.ws?.send(
        JSON.stringify({ type: "SCORE_RECORDED", score, txHash: hash })
      );
    } catch (err) {
      console.error("recordAttemptEnd failed:", err.message);
      game.ws?.send(
        JSON.stringify({ type: "ERROR", message: "Score recording failed" })
      );
    }
  });
}

// --- Game timeout: auto-crash stale games ---
setInterval(() => {
  const now = Date.now();
  for (const [player, game] of activeGames.entries()) {
    if (now - game.startTime > MAX_GAME_DURATION_MS + 10000) {
      console.log(`[timeout] Auto-crashing stale game for ${player.slice(0, 10)}`);
      handleCrash(player);
    }
  }
}, 30000);

// --- Operator wallet balance monitoring ---
const LOW_BALANCE_THRESHOLD = 0.005; // ETH — warn when below this

async function checkOperatorBalance() {
  try {
    const balance = await publicClient.getBalance({ address: account.address });
    const ethBalance = Number(balance) / 1e18;
    if (ethBalance < LOW_BALANCE_THRESHOLD) {
      console.warn(
        `[WARN] Operator balance LOW: ${ethBalance.toFixed(6)} ETH — fund ${account.address}`
      );
    } else {
      console.log(`[balance] Operator: ${ethBalance.toFixed(6)} ETH`);
    }
  } catch (err) {
    console.error("[balance] Failed to check operator balance:", err.message);
  }
}

// Check on startup and every 5 minutes
checkOperatorBalance();
setInterval(checkOperatorBalance, 5 * 60 * 1000);

// --- Auto-end expired tournaments ---
async function autoEndTournaments() {
  try {
    const count = await publicClient.readContract({
      address: MEGARALLY_ADDRESS,
      abi: MEGARALLY_ABI,
      functionName: "tournamentCount",
    });

    const now = BigInt(Math.floor(Date.now() / 1000));

    for (let i = 1; i <= Number(count); i++) {
      const t = await publicClient.readContract({
        address: MEGARALLY_ADDRESS,
        abi: MEGARALLY_ABI,
        functionName: "tournaments",
        args: [BigInt(i)],
      });

      const ended = t[6];
      const endTime = t[3];

      if (!ended && now >= endTime) {
        console.log(`[auto-end] Ending tournament #${i} (expired at ${endTime})`);
        queueTx(async () => {
          const hash = await walletClient.writeContract({
            address: MEGARALLY_ADDRESS,
            abi: MEGARALLY_ABI,
            functionName: "endTournament",
            args: [BigInt(i)],
            gas: 500000n,
          });
          console.log(`[auto-end] Tournament #${i} ended, tx: ${hash}`);
        });
      }
    }
  } catch (err) {
    console.error("[auto-end] Error:", err.message);
  }
}

// Check on startup and every 30 seconds
autoEndTournaments();
setInterval(autoEndTournaments, 30000);

// --- Auto-withdraw operator fees ---
async function autoWithdrawFees() {
  try {
    const pending = await publicClient.readContract({
      address: MEGARALLY_ADDRESS,
      abi: MEGARALLY_ABI,
      functionName: "pendingWithdrawals",
      args: [account.address],
    });

    if (pending > 0n) {
      const ethAmount = Number(pending) / 1e18;
      console.log(`[auto-withdraw] Claiming ${ethAmount.toFixed(6)} ETH in fees`);
      queueTx(async () => {
        const hash = await walletClient.writeContract({
          address: MEGARALLY_ADDRESS,
          abi: MEGARALLY_ABI,
          functionName: "withdraw",
          gas: 500000n,
        });
        console.log(`[auto-withdraw] Withdrawn, tx: ${hash}`);
      });
    }
  } catch (err) {
    console.error("[auto-withdraw] Error:", err.message);
  }
}

// Check on startup and every 5 minutes
autoWithdrawFees();
setInterval(autoWithdrawFees, 5 * 60 * 1000);

console.log(`Operator backend running on ws://localhost:${PORT}`);
console.log(`Operator address: ${account.address}`);
