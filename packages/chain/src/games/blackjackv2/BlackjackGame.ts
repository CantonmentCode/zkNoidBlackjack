import { runtimeModule, RuntimeModule } from "@proto-kit/module";
import { Field, PublicKey, Bool } from "o1js";
import { State, StateMap, assert } from "@proto-kit/protocol";
import { state, runtimeMethod } from "@proto-kit/module";
import { UInt64 } from "@proto-kit/library";

interface BlackjackGameConfig {}

@runtimeModule()
export class BlackjackGame extends RuntimeModule<BlackjackGameConfig> {
  @state() dealerHand = StateMap.from<Public, UInt64>(UInt64, UInt64);
  @state() playerHand = StateMap.from<UInt64, UInt64>(UInt64, UInt64);

  @state() dealerScore = State.from<UInt64>(UInt64);
  @state() playerScore = State.from<UInt64>(UInt64);

  @state() playerHandSize = State.from<UInt64>(UInt64); // Track the number of cards in player's hand
  @state() dealerHandSize = State.from<UInt64>(UInt64); // Track the number of cards in dealer's hand

  @state() gameStatus = State.from<Field>(Field); // 0: player's turn, 1: dealer's turn

  @runtimeMethod()
  async startGame() {
    await this.playerHand.set(UInt64.from(0), this.drawCard());
    await this.playerHand.set(UInt64.from(1), this.drawCard());
    await this.playerHandSize.set(UInt64.from(2)); // Player starts with 2 cards

    await this.dealerHand.set(UInt64.from(0), this.drawCard());
    await this.dealerHand.set(UInt64.from(1), this.drawCard());
    await this.dealerHandSize.set(UInt64.from(2)); // Dealer starts with 2 cards

    await this.gameStatus.set(Field(0)); // Player's turn
  }

  @runtimeMethod()
  async hit() {
    const handSizeOpt = await this.playerHandSize.get(); // Get Option<UInt64>
    const handSize = handSizeOpt?.value ?? UInt64.from(0); // Unwrap Option or default to 0

    // Ensure the player has fewer than 5 cards
    assert(handSize.lessThan(UInt64.from(5)), "You cannot have more than 5 cards");

    const newCard = this.drawCard();
    await this.playerHand.set(handSize, newCard); // Add new card to player's hand
    await this.playerHandSize.set(handSize.add(UInt64.from(1))); // Increment hand size
  }

  @runtimeMethod()
  async stand() {
    await this.gameStatus.set(Field(1)); // Change status to dealer's turn
    // Dealer logic can go here
  }

  drawCard(): UInt64 {
    // Simulate drawing a card with a value between 1 and 11
    return UInt64.from(Math.floor(Math.random() * 11) + 1);
  }
}
