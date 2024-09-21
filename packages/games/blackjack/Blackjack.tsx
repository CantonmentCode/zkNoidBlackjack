import { useContext, useEffect, useState } from "react";
import { Field, Poseidon, PublicKey, UInt64 } from "o1js";
import { useNetworkStore } from "@zknoid/sdk/lib/stores/network";
import { ClientAppChain } from "zknoid-chain-dev";
import { blackjackConfig } from "./config";
import ZkNoidGameContext from "@zknoid/sdk/lib/contexts/ZkNoidGameContext";
import { useProtokitChainStore } from "@zknoid/sdk/lib/stores/protokitChain";
import { motion } from "framer-motion";
import Button from "@zknoid/sdk/components/shared/Button";
import { useNotificationStore } from "@zknoid/sdk/components/shared/Notification/lib/notificationStore";
import GamePage from "@zknoid/sdk/components/framework/GamePage";


export default function Blackjack({
  params,
}: {
  params: { competitionId: string };
}) {
  const [dealerScore, setDealerScore] = useState(0n);
  const [playerScore, setPlayerScore] = useState(0n);
  const [playerHand, setPlayerHand] = useState<number[]>([]);
  const [dealerHand, setDealerHand] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState("Player's turn");

  const { client } = useContext(ZkNoidGameContext);
  const networkStore = useNetworkStore();
  const protokitChain = useProtokitChainStore();
  const notificationStore = useNotificationStore();

  const client_ = client as ClientAppChain<
    typeof blackjackConfig.runtimeModules,
    any,
    any,
    any
  >;

  const query = networkStore.protokitClientStarted
    ? client_.query.runtime.BlackjackGame
    : undefined;

  const startGame = async () => {
    const blackjackLogic = client_.runtime.resolve("BlackjackGame");

    const tx = await client.transaction(
      PublicKey.fromBase58(networkStore.address!),
      async () => {
        await blackjackLogic.startGame();
      },
    );

    await tx.sign();
    await tx.send();
    notificationStore.create({ type: "success", message: "Game started" });
  };

  const hit = async () => {
    const blackjackLogic = client_.runtime.resolve("BlackjackGame");

    const tx = await client.transaction(
      PublicKey.fromBase58(networkStore.address!),
      async () => {
        await blackjackLogic.hit();
      },
    );

    await tx.sign();
    await tx.send();
  };

  const stand = async () => {
    const blackjackLogic = client_.runtime.resolve("BlackjackGame");

    const tx = await client.transaction(
      PublicKey.fromBase58(networkStore.address!),
      async () => {
        await blackjackLogic.stand();
      },
    );

    await tx.sign();
    await tx.send();
  };

  useEffect(() => {
    query?.playerHand.get(UInt64.from(0)).then((hand) => {
      console.log("hand 1", hand)
      if (hand) setPlayerHand(hand.toBigInt());
    });

    query?.dealerHand.get(UInt64.from(1)).then((hand) => {
      if (hand) setDealerHand(hand.toBigInt());
    });

    query?.gameStatus.get().then((status) => {
      if (status) setGameStatus(status.toString());
    });

    query?.playerScore.get().then((score) => {
      if (score) setPlayerScore(score.toBigInt());
    });

    query?.dealerScore.get().then((score) => {
      if (score) setDealerScore(score.toBigInt());
    });
  }, [protokitChain.block]);

  return (
    <GamePage gameConfig={blackjackConfig}>
      <motion.div
        className={
          "flex grid-cols-4 flex-col-reverse gap-4 pt-10 lg:grid lg:pt-0"
        }
        animate={"windowed"}
      >
        <div className="flex flex-col gap-4 lg:hidden">
          <span className="w-full text-headline-2 font-bold">Rules</span>
          <span className="font-plexsans text-buttons-menu font-normal">
            {blackjackConfig.rules}
          </span>
        </div>

        <div className="hidden h-full w-full flex-col gap-4 lg:flex">
          <div className="flex w-full gap-2 font-plexsans text-[20px]/[20px] uppercase text-left-accent">
            <span>Game status:</span>
            <span>{gameStatus}</span>
          </div>
          <span className="text-[20px]/[20px]">Player score: {playerScore.toString()}</span>
          <span className="text-[20px]/[20px]">Dealer score: {dealerScore.toString()}</span>

          <div className="flex w-full gap-2 font-plexsans text-[20px]/[20px] text-foreground">
            <div className="flex flex-col gap-1">
              <span>Your hand: {playerHand.toString()}</span>
              <Button label="StartGame" onClick={startGame} />
              <Button label="Hit" onClick={hit} />
              <Button label="Stand" onClick={stand} />
            </div>
          </div>
        </div>
      </motion.div>
    </GamePage>
  );
}
