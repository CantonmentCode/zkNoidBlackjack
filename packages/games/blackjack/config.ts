import { createZkNoidGameConfig } from "@zknoid/sdk/lib/createConfig";
import { ZkNoidGameType } from "@zknoid/sdk/lib/platform/game_types";
import { BlackjackLogic } from "zknoid-chain-dev";
import BlackjackPage from "./Blackjack";
import {
  ZkNoidGameFeature,
  ZkNoidGameGenre,
} from "@zknoid/sdk/lib/platform/game_tags";

export const blackjackConfig = createZkNoidGameConfig({
  id: "blackjack",
  type: ZkNoidGameType.SinglePlayer,
  name: "Blackjack",
  description: "A simple zero-knowledge blackjack game",
  image: "/image/games/blackjack.svg",
  genre: ZkNoidGameGenre.BoardGames,
  features: [ZkNoidGameFeature.SinglePlayer],
  isReleased: true,
  releaseDate: new Date(2024, 0, 1),
  popularity: 70,
  author: "Your Team",
  runtimeModules: {
    BlackjackLogic,
  },
  page: BlackjackPage,
  rules: `Blackjack is a card game where the goal is to get as close to 21 without going over. The dealer deals cards according to the rules.`,
});
