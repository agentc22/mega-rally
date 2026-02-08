import "dotenv/config";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { WebSocketServer } from "ws";

const MEGARALLY_ADDRESS = "0x6d32B9c3d539b2066b2b44915e09CDe94673bA5b";

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
];

const megaethTestnet = defineChain({
  id: 6343,
  name: "MegaETH Testnet",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: { http: ["https://carrot.megaeth.com/rpc"] },
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
  transport: http("https://carrot.megaeth.com/rpc"),
});

const publicClient = createPublicClient({
  chain: megaethTestnet,
  transport: http("https://carrot.megaeth.com/rpc"),
});

// Track active games
const activeGames = new Map(); // playerId -> { tournamentId, obstacles, ws }

// TX queue to prevent nonce conflicts
let txQueue = Promise.resolve();
function queueTx(fn) {
  txQueue = txQueue.then(fn).catch((err) => {
    console.error("TX failed:", err.message);
  });
  return txQueue;
}

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log("Received:", msg.type, msg.player?.slice(0, 10));

      switch (msg.type) {
        case "START_ATTEMPT":
          await handleStartAttempt(msg.tournamentId, msg.player, ws);
          break;

        case "OBSTACLE_PASSED":
          await handleObstaclePassed(msg.player, msg.obstacleId);
          break;

        case "CRASH":
          await handleCrash(msg.player, msg.score);
          break;

        default:
          ws.send(JSON.stringify({ type: "ERROR", message: "Unknown type" }));
      }
    } catch (err) {
      console.error("Message error:", err);
      ws.send(
        JSON.stringify({ type: "ERROR", message: err.message })
      );
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    // Clean up any active games for this connection
    for (const [player, game] of activeGames.entries()) {
      if (game.ws === ws) {
        activeGames.delete(player);
      }
    }
  });
});

async function handleStartAttempt(tournamentId, player, ws) {
  activeGames.set(player, {
    tournamentId,
    obstacles: [],
    ws,
    startTime: Date.now(),
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

  game.obstacles.push(obstacleId);

  // Record onchain — fire and forget for speed
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

async function handleCrash(player, clientScore) {
  const game = activeGames.get(player);
  if (!game) return;

  const score = clientScore || game.obstacles.length;
  activeGames.delete(player);

  queueTx(async () => {
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
  });
}

console.log(`Operator backend running on ws://localhost:${PORT}`);
console.log(`Operator address: ${account.address}`);
