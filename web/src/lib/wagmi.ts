import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { megaethTestnet } from "./chains";

export const config = createConfig({
  chains: [megaethTestnet],
  connectors: [injected()],
  transports: {
    [megaethTestnet.id]: http("https://carrot.megaeth.com/rpc"),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
