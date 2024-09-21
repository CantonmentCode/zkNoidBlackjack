import { useContext, useEffect, useState } from "react";
import { Field, PublicKey, UInt32 } from "o1js";
import { useNetworkStore } from "@zknoid/sdk/lib/stores/network";
import { ClientAppChain } from "zknoid-chain-dev";
import { blackjackConfig } from "./config";
import ZkNoidGameContext from "@zknoid/sdk/lib/contexts/ZkNoidGameContext";
import { useProtokitChainStore } from "@zknoid/sdk/lib/stores/protokitChain";
import { motion } from "framer-motion";
import Button from "@zknoid/sdk/components/shared/Button";
import GamePage from "@zknoid/sdk/components/framework/GamePage";

export default function Blackjack({
  params,
}: {
  params: { competitionId: string };
}) {
  const { client } = useContext(ZkNoidGameContext);

  if (!client) {
    throw Error("Context app chain client is not set");
  }

  const networkStore = useNetworkStore();
  const protokitChain = useProtokitChainStore();

  const client_ = client as ClientAppChain<
    typeof blackjackConfig.runtimeModules,
    any,
    any,
    any
  >;

  const query = networkStore.protokitClientStarted
    ? client_.query.runtime.BlackjackLogic
    : undefined;

  const [playerHand, setPlayerHand] = useState<number[]>([]);
  const [dealerHand, setDealerHand] = useState<(number | null)[]>([]);
  const [gameState, setGameState] = useState<string>("NOT_STARTED");

  // Start the game
  const startGame = async () => {
    const blackjackLogic = client_.runtime.resolve("BlackjackLogic");

    const tx = await client.transaction(
      PublicKey.fromBase58(networkStore.address!),
      async () => {
        await blackjackLogic.startGame();
      }
    );

    await tx.sign();
    await tx.send();
    setGameState("IN_PROGRESS");
  };

  // Player chooses to hit
  const hit = async () => {
    const blackjackLogic = client_.runtime.resolve("BlackjackLogic");

    const tx = await client.transaction(
      PublicKey.fromBase58(networkStore.address!),
      async () => {
        await blackjackLogic.playerHit();
      }
    );

    await tx.sign();
    await tx.send();
  };

  // Player chooses to stand
  const stand = async () => {
    const blackjackLogic = client_.runtime.resolve("BlackjackLogic");

    const tx = await client.transaction(
      PublicKey.fromBase58(networkStore.address!),
      async () => {
        await blackjackLogic.playerStand();
      }
    );

    await tx.sign();
    await tx.send();
    setGameState("FINISHED");
  };

  // Fetch game state from the chain
  useEffect(() => {
    if (query && networkStore.address) {
      const player = PublicKey.fromBase58(networkStore.address);

      const fetchHand = async (isPlayer: boolean) => {
        const handSizeOption = isPlayer
          ? await query.playerHandSizes.get(player)
          : await query.dealerHandSizes.get(player);

        let handSize = 0;
        if (handSizeOption.isSome.toBoolean()) {
          handSize = Number(UInt32.toValue(handSizeOption.value));
        }

        const hand: number[] = [];

        for (let i = 0; i < handSize; i++) {
          const cardOption = isPlayer
            ? await query.playerCards[i].get(player)
            : await query.dealerCards[i].get(player);

          if (cardOption.isSome.toBoolean()) {
            const cardValue = UInt32.toValue(cardOption.value);
            hand.push(Number(cardValue));
          } else {
            hand.push(0); // Or handle missing card appropriately
          }
        }

        return hand;
      };

      fetchHand(true).then(setPlayerHand);
      fetchHand(false).then((dealerHandArray) => {
        setDealerHand(
          gameState === "FINISHED"
            ? dealerHandArray
            : [dealerHandArray[0], null]
        );
      });

      //@ts-ignore
      query.gameStates.get(player).then((stateOption) => {
        if (stateOption.isSome.toBoolean()) {
          const stateValue = Number(UInt32.toValue(stateOption.value));
          if (stateValue === 0) setGameState("NOT_STARTED");
          else if (stateValue === 1) setGameState("IN_PROGRESS");
          else if (stateValue === 2) setGameState("FINISHED");
        }
      });
    }
  }, [protokitChain.block, gameState]);

  // Determine the winner
  const determineWinner = () => {
    const playerTotal = calculateHandValue(playerHand);
    const dealerTotal = calculateHandValue(dealerHand as number[]);

    if (playerTotal > 21) {
      return "You busted! Dealer wins.";
    } else if (dealerTotal > 21) {
      return "Dealer busted! You win.";
    } else if (playerTotal > dealerTotal) {
      return "You win!";
    } else if (playerTotal < dealerTotal) {
      return "Dealer wins.";
    } else {
      return "It's a tie!";
    }
  };

  // Calculate hand value
  const calculateHandValue = (hand: number[]) => {
    let total = 0;
    let aces = 0;
    hand.forEach((card) => {
      if (card === 1) {
        aces += 1;
        total += 11;
      } else if (card > 10) {
        total += 10;
      } else {
        total += card;
      }
    });
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  };

  return (
    <GamePage gameConfig={blackjackConfig}>
      <motion.div className="flex flex-col gap-4 pt-10">
        <div>
          <h2 className="text-headline-2 font-bold">Blackjack Game</h2>
          <p>{blackjackConfig.rules}</p>
        </div>
        <div>
          <h3>Your Hand: {playerHand.join(", ")}</h3>
          <h3>
            Dealer's Hand:{" "}
            {dealerHand
              .map((card) => (card !== null ? card : "Hidden"))
              .join(", ")}
          </h3>
          {gameState === "IN_PROGRESS" && (
            <div className="flex gap-4">
              <Button label="Hit" onClick={hit} />
              <Button label="Stand" onClick={stand} />
            </div>
          )}
          {gameState === "FINISHED" && (
            <div>
              <h3>Game Over: {determineWinner()}</h3>
              <Button
                label="Play Again"
                onClick={async () => {
                  const blackjackLogic =
                    client_.runtime.resolve("BlackjackLogic");
                  const tx = await client.transaction(
                    PublicKey.fromBase58(networkStore.address!),
                    async () => {
                      await blackjackLogic.resetGame();
                    }
                  );
                  await tx.sign();
                  await tx.send();
                  setGameState("NOT_STARTED");
                }}
              />
            </div>
          )}
          {gameState === "NOT_STARTED" && (
            <Button label="Start Game" onClick={startGame} />
          )}
        </div>
      </motion.div>
    </GamePage>
  );
}
