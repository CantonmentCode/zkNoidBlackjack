import { runtimeModule, RuntimeModule } from "@proto-kit/module";
import { Field, PublicKey, UInt32, Poseidon, Bool } from "o1js";
import { StateMap, assert } from "@proto-kit/protocol";
import { state, runtimeMethod } from "@proto-kit/module";

interface BlackjackLogicConfig {}

const MAX_HAND_SIZE = 10;

@runtimeModule()
export class BlackjackLogic extends RuntimeModule<BlackjackLogicConfig> {
  // StateMaps for player's hand cards
  @state()
  playerHandSizes = StateMap.from<PublicKey, UInt32>(PublicKey, UInt32);

  @state()
  playerCards = Array.from({ length: MAX_HAND_SIZE }, () =>
    StateMap.from<PublicKey, UInt32>(PublicKey, UInt32)
  );

  // StateMaps for dealer's hand cards
  @state()
  dealerHandSizes = StateMap.from<PublicKey, UInt32>(PublicKey, UInt32);

  @state()
  dealerCards = Array.from({ length: MAX_HAND_SIZE }, () =>
    StateMap.from<PublicKey, UInt32>(PublicKey, UInt32)
  );

  @state()
  gameStates = StateMap.from<PublicKey, UInt32>(PublicKey, UInt32);

  @runtimeMethod()
  async startGame() {
    const player = this.transaction.sender.value;
    const existingStateOption = await this.gameStates.get(player);
    const existingState = existingStateOption.isSome
      ? UInt32.toValue(existingStateOption.value)
      : 0;

    assert(Bool(existingState === 0), "Game already in progress");

    let nonce = 0;

    // Draw cards
    const playerCard1 = this.drawCard(player, nonce++);
    const playerCard2 = this.drawCard(player, nonce++);
    const dealerCard1 = this.drawCard(player, nonce++);
    const dealerCard2 = this.drawCard(player, nonce++);

    // Set player's hand
    await this.playerCards[0].set(player, playerCard1);
    await this.playerCards[1].set(player, playerCard2);
    await this.playerHandSizes.set(player, UInt32.from(2));

    // Set dealer's hand
    await this.dealerCards[0].set(player, dealerCard1);
    await this.dealerCards[1].set(player, dealerCard2);
    await this.dealerHandSizes.set(player, UInt32.from(2));

    await this.gameStates.set(player, UInt32.from(1)); // IN_PROGRESS
  }

  @runtimeMethod()
  async playerHit() {
    const player = this.transaction.sender.value;
    const gameStateOption = await this.gameStates.get(player);
    assert(
      Bool(gameStateOption.isSome) &&
        Bool(Number(UInt32.toValue(gameStateOption.value)) === 1),
      "Game not in progress"
    );

    const handSizeOption = await this.playerHandSizes.get(player);
    assert(handSizeOption.isSome, "Player hand size not found");
    let handSize = Number(UInt32.toValue(handSizeOption.value));
    assert(Bool(handSize < MAX_HAND_SIZE), "Hand is full");

    const nonce = handSize + 2; // Adjust nonce based on previous draws
    const newCard = this.drawCard(player, nonce);
    await this.playerCards[handSize].set(player, newCard);
    handSize += 1;
    await this.playerHandSizes.set(player, UInt32.from(handSize));

    // Check if player busts
    const handValue = await this.calculateHandValue(player, true);
    if (handValue > 21) {
      await this.gameStates.set(player, UInt32.from(2)); // FINISHED
    }
  }

  @runtimeMethod()
  async playerStand() {
    const player = this.transaction.sender.value;
    const gameStateOption = await this.gameStates.get(player);
    assert(
      Bool(gameStateOption.isSome) &&
        Bool(Number(UInt32.toValue(gameStateOption.value)) === 1),
      "Game not in progress"
    );

    let dealerHandValue = await this.calculateHandValue(player, false);
    let dealerHandSizeOption = await this.dealerHandSizes.get(player);
    assert(dealerHandSizeOption.isSome, "Dealer hand size not found");
    let dealerHandSize = Number(UInt32.toValue(dealerHandSizeOption.value));

    while (dealerHandValue < 17 && dealerHandSize < MAX_HAND_SIZE) {
      const nonce = dealerHandSize + 2; // Adjust nonce
      const newCard = this.drawCard(player, nonce);
      await this.dealerCards[dealerHandSize].set(player, newCard);
      dealerHandSize += 1;
      await this.dealerHandSizes.set(player, UInt32.from(dealerHandSize));
      dealerHandValue = await this.calculateHandValue(player, false);
    }

    await this.gameStates.set(player, UInt32.from(2)); // FINISHED
  }

  @runtimeMethod()
  async resetGame() {
    const player = this.transaction.sender.value;
    // Reset game state and hand sizes
    await this.gameStates.set(player, UInt32.zero);
    await this.playerHandSizes.set(player, UInt32.zero);
    await this.dealerHandSizes.set(player, UInt32.zero);

    // Reset player's cards
    for (let i = 0; i < MAX_HAND_SIZE; i++) {
      await this.playerCards[i].set(player, UInt32.zero);
      await this.dealerCards[i].set(player, UInt32.zero);
    }
  }

  drawCard(player: PublicKey, nonce: number): UInt32 {
    const seed = Poseidon.hash([
      player.x,
      player.isOdd.toField(),
      Field(nonce),
    ]);
    const cardValue = seed.toBigInt() % 13n;
    return UInt32.from(Number(cardValue) + 1); // Card values from 1 to 13
  }

  async calculateHandValue(
    player: PublicKey,
    isPlayer: boolean
  ): Promise<number> {
    const handSizeOption = isPlayer
      ? await this.playerHandSizes.get(player)
      : await this.dealerHandSizes.get(player);

    assert(handSizeOption.isSome, "Hand size not found");

    const handSize = UInt32.toValue(handSizeOption.value);

    let total = 0;
    let aces = 0;

    for (let i = 0; i < handSize; i++) {
      const cardOption = isPlayer
        ? await this.playerCards[i].get(player)
        : await this.dealerCards[i].get(player);

      assert(cardOption.isSome, `Card ${i + 1} not found`);

      const cardValue = Number(UInt32.toValue(cardOption.value));

      if (cardValue === 1) {
        aces += 1;
        total += 11;
      } else if (cardValue > 10) {
        total += 10;
      } else {
        total += cardValue;
      }
    }

    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  }
}
