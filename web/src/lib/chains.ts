import { defineChain } from "viem";

export const megaethTestnet = defineChain({
  id: 6343,
  name: "MegaETH Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_RPC_URL || "https://carrot.megaeth.com/rpc",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "MegaETH Explorer",
      url: "https://megaeth-testnet-v2.blockscout.com",
    },
  },
});
