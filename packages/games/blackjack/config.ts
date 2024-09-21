import { createZkNoidGameConfig } from "@zknoid/sdk/lib/createConfig";
import { ZkNoidGameType } from "@zknoid/sdk/lib/platform/game_types";
import { BlackjackGame } from "zknoid-chain-dev";
import {
  ZkNoidGameFeature,
  ZkNoidGameGenre,
} from "@zknoid/sdk/lib/platform/game_tags";
import Blackjack from "./Blackjack";

export const blackjackConfig = createZkNoidGameConfig({
  id: "blackjack",
  type: ZkNoidGameType.PVP,
  name: "Blackjack",
  description: "Try to beat the dealer without going over 21!",
  image: "/image/games/blackjack.svg",
  genre:  ZkNoidGameGenre.BoardGames,
  features: [ZkNoidGameFeature.Multiplayer],
  isReleased: true,
  releaseDate: new Date(2024, 1, 1),
  popularity: 80,
  author: "ZkNoid Team",
  rules:
    "In Blackjack, players compete against the dealer to get as close to 21 as possible without going over. Each player can hit to take another card or stand to hold their hand.",
  runtimeModules: {
    BlackjackGame,
  },
  page: Blackjack,
});
