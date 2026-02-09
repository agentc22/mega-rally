export const MEGARALLY_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x3F296580DDC77c21D8d6B43B92C7aE8f021A9F8e") as `0x${string}`;

export const MEGARALLY_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "_operator", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "FEE_BPS",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_ATTEMPTS",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createTournament",
    inputs: [
      { name: "_entryFee", type: "uint256" },
      { name: "_duration", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "enter",
    inputs: [{ name: "_tournamentId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
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
    name: "getEntry",
    inputs: [
      { name: "_tournamentId", type: "uint256" },
      { name: "_player", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "player", type: "address" },
          { name: "tournamentId", type: "uint256" },
          { name: "scores", type: "uint256[3]" },
          { name: "attemptsUsed", type: "uint8" },
          { name: "totalScore", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLeaderboard",
    inputs: [{ name: "_tournamentId", type: "uint256" }],
    outputs: [
      { name: "", type: "address[]" },
      { name: "", type: "uint256[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTournamentPlayers",
    inputs: [{ name: "_tournamentId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "operator",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
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
      { name: "winner", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "TournamentCreated",
    inputs: [
      { name: "tournamentId", type: "uint256", indexed: true },
      { name: "entryFee", type: "uint256", indexed: false },
      { name: "endTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PlayerEntered",
    inputs: [
      { name: "tournamentId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "AttemptStarted",
    inputs: [
      { name: "tournamentId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "attemptNumber", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ObstaclePassed",
    inputs: [
      { name: "tournamentId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "attemptNumber", type: "uint8", indexed: false },
      { name: "obstacleId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AttemptEnded",
    inputs: [
      { name: "tournamentId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "attemptNumber", type: "uint8", indexed: false },
      { name: "score", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TournamentEnded",
    inputs: [
      { name: "tournamentId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "prize", type: "uint256", indexed: false },
    ],
  },
] as const;
