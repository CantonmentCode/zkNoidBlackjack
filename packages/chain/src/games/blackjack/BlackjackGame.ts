import { state, runtimeMethod, runtimeModule } from '@proto-kit/module';
import { State, StateMap, Option, assert } from '@proto-kit/protocol';
import {
  PublicKey,
  Struct,
  UInt64,
  Provable,
  Bool,
  Field,
  Poseidon,
  Void,
} from 'o1js';
import { UInt64 as ProtoUInt64, UInt } from '@proto-kit/library';

import { MatchMaker } from '../../engine/MatchMaker';
import { Lobby } from '../../engine/LobbyManager';

export class Card extends Struct({
  suit: UInt64,
  value: UInt64,
}) {}

export class Hand extends Struct({
  cards: [Card, Card, Card, Card, Card], // Max 5 cards per hand
  cardCount: UInt64,
}) {}

export class GameInfo extends Struct({
  player: PublicKey,
  dealer: PublicKey,
  // playerHand: Hand,
  // dealerHand: Hand,
  currentTurn: PublicKey,
  lastMoveBlockHeight: UInt64,
  bet: ProtoUInt64,
  gameState: UInt64, // 0: ongoing, 1: player won, 2: dealer won, 3: tie
}) {}

export class GameHand extends Struct({
  playerHand: Hand,
  dealerHand: Hand,
  cardSequenceHash: Field,
  currentCardIndex: UInt64,

}) {}

@runtimeModule()
export class BlackjackLogic extends MatchMaker {
  @state() public games = StateMap.from<UInt64, GameInfo>(UInt64, GameInfo);
  @state() public gamesNum = State.from<UInt64>(UInt64);
  @state() public gamesHand = StateMap.from<UInt64, GameHand>(UInt64, GameHand)

  public override async initGame(lobby: Lobby, shouldUpdate: Bool): Promise<UInt64> {
    const currentGameId = lobby.id;

    await this.games.set(
      Provable.if(shouldUpdate, currentGameId, UInt64.from(0)),
      new GameInfo({
        player: lobby.players[0],
        dealer: lobby.players[1],
        // playerHand: initialPlayerHand,
        // dealerHand: initialDealerHand,
        currentTurn: lobby.players[0],
        lastMoveBlockHeight: this.network.block.height,
        bet: lobby.participationFee,
        gameState: UInt64.from(0),
      }),
    );

    await this.gameFund.set(
      currentGameId,
      ProtoUInt64.from(lobby.participationFee),
    );

    return await super.initGame(lobby, shouldUpdate);
  }

  @runtimeMethod()
  public async startBlackjackGame(lobby: Lobby, shouldUpdate: Bool, cardSequence: Card[]): Promise<Void> {
    const currentGameId = lobby.id;
    const initialPlayerHand = new Hand({
      cards: [cardSequence[0], cardSequence[1], Card.empty(), Card.empty(), Card.empty()],
      cardCount: UInt64.from(2),
    });

    const initialDealerHand = new Hand({
      cards: [cardSequence[2], cardSequence[3], Card.empty(), Card.empty(), Card.empty()],
      cardCount: UInt64.from(2),
    });

    const cardSequenceHash = Poseidon.hash(cardSequence);

    await this.gamesHand.set(
      Provable.if(shouldUpdate, currentGameId, UInt64.from(0)),
      new GameHand({
        playerHand: initialPlayerHand,
        dealerHand: initialDealerHand,
        cardSequenceHash: cardSequenceHash,
        currentCardIndex: UInt64.from(4)
      
      }),
    );

    return 
  }

  private calculateHandValue(hand: Hand): UInt64 {
    let total = UInt64.from(0);
    let aceCount = UInt64.from(0);

    for (let i = 0; i < 5; i++) {
      const card = hand.cards[i];
      if (card.value.greaterThan(UInt64.from(0))) {
        if (card.value.greaterThan(UInt64.from(10))) {
          total = total.add(UInt64.from(10));
        } else if (card.value.equals(UInt64.from(1))) {
          aceCount = aceCount.add(UInt64.from(1));
        } else {
          total = total.add(card.value);
        }
      }
    }

    // Handle Aces
    for (let i = 0; i < aceCount.toBigInt(); i++) {
      if (total.add(UInt64.from(11)).lessThanOrEqual(UInt64.from(21))) {
        total = total.add(UInt64.from(11));
      } else {
        total = total.add(UInt64.from(1));
      }
    }

    return total;
  }

  @runtimeMethod()
  public async hit(gameId: UInt64, cardSequence: Card[]): Promise<void> {
    const game = await this.games.get(gameId);
    assert(game.isSome, 'Invalid game id');
    assert(game.value.gameState.equals(UInt64.from(0)), 'Game has ended');
    assert(game.value.currentTurn.equals(game.value.player), 'Not player\'s turn');

    const updatedHand = new Hand({
      cards: [
        ...game.value.playerHand.cards.slice(0, game.value.playerHand.cardCount.toNumber()),
        // TODO implement draw card that increment currentCardIndex
        this.drawCard(cardSequence),
        ...game.value.playerHand.cards.slice(game.value.playerHand.cardCount.toNumber() + 1),
      ],
      cardCount: game.value.playerHand.cardCount.add(UInt64.from(1)),
    });

    const handValue = this.calculateHandValue(updatedHand);

    game.value.playerHand = updatedHand;
    game.value.currentCardIndex = game.value.currentCardIndex.add(UInt64.from(1));
    game.value.lastMoveBlockHeight = this.network.block.height;

    if (handValue.greaterThan(UInt64.from(21))) {
      game.value.gameState = UInt64.from(2); // Dealer wins
      await this.endGame(gameId, game.value);
    } else if (handValue.equals(UInt64.from(21)) || updatedHand.cardCount.equals(UInt64.from(5))) {
      game.value.currentTurn = game.value.dealer;
    }

    await this.games.set(gameId, game.value);
  }

  @runtimeMethod()
  public async stand(gameId: UInt64): Promise<void> {
    const game = await this.games.get(gameId);
    assert(game.isSome, 'Invalid game id');
    assert(game.value.gameState.equals(UInt64.from(0)), 'Game has ended');
    assert(game.value.currentTurn.equals(game.value.player), 'Not player\'s turn');

    game.value.currentTurn = game.value.dealer;
    game.value.lastMoveBlockHeight = this.network.block.height;

    await this.games.set(gameId, game.value);
  }

  @runtimeMethod()
  public async doubleDown(gameId: UInt64, cardSequence: Card[]): Promise<void> {
    const game = await this.games.get(gameId);
    assert(game.isSome, 'Invalid game id');
    assert(game.value.gameState.equals(UInt64.from(0)), 'Game has ended');
    assert(game.value.currentTurn.equals(game.value.player), 'Not player\'s turn');
    assert(game.value.playerHand.cardCount.equals(UInt64.from(2)), 'Can only double down on initial hand');

    game.value.bet = game.value.bet.mul(UInt64.from(2));
    await this.gameFund.set(gameId, ProtoUInt64.from(game.value.bet));

    const updatedHand = new Hand({
      cards: [...game.value.playerHand.cards.slice(0, 2), this.drawCard(cardSequence), Card.empty(), Card.empty()],
      cardCount: UInt64.from(3),
    });

    game.value.playerHand = updatedHand;
    game.value.currentCardIndex = game.value.currentCardIndex.add(UInt64.from(1));
    game.value.currentTurn = game.value.dealer;
    game.value.lastMoveBlockHeight = this.network.block.height;

    await this.games.set(gameId, game.value);
  }

  @runtimeMethod()
  private async dealerPlay(gameId: UInt64, cardSequence: Card[]): Promise<void> {
    const game = await this.games.get(gameId);
    assert(game.isSome, 'Invalid game id');

    let dealerHand = game.value.dealerHand;
    let dealerValue = this.calculateHandValue(dealerHand);
    let currentCardIndex = game.value.currentCardIndex;

    while (dealerValue.lessThan(UInt64.from(17)) && dealerHand.cardCount.lessThan(UInt64.from(5))) {
      const newCard = this.drawCard(cardSequence)
      dealerHand = new Hand({
        cards: [
          ...dealerHand.cards.slice(0, dealerHand.cardCount.toNumber()),
          newCard,
          ...dealerHand.cards.slice(dealerHand.cardCount.toNumber() + 1),
        ],
        cardCount: dealerHand.cardCount.add(UInt64.from(1)),
      });
      dealerValue = this.calculateHandValue(dealerHand);
      currentCardIndex = currentCardIndex.add(UInt64.from(1));
    }

    game.value.dealerHand = dealerHand;
    game.value.currentCardIndex = currentCardIndex;
    game.value.lastMoveBlockHeight = this.network.block.height;

    const playerValue = this.calculateHandValue(game.value.playerHand);

    if (dealerValue.greaterThan(UInt64.from(21)) || playerValue.greaterThan(dealerValue)) {
      game.value.gameState = UInt64.from(1); // Player wins
    } else if (dealerValue.greaterThan(playerValue)) {
      game.value.gameState = UInt64.from(2); // Dealer wins
    } else {
      game.value.gameState = UInt64.from(3); // Tie
    }

    await this.games.set(gameId, game.value);
    await this.endGame(gameId, game.value);
  }

  private async endGame(gameId: UInt64, game: GameInfo): Promise<void> {
    if (game.gameState.equals(UInt64.from(1))) {
      // Player wins
      await this.acquireFunds(
        gameId,
        game.player,
        game.dealer,
        ProtoUInt64.from(2),
        ProtoUInt64.from(0),
        ProtoUInt64.from(2),
      );
    } else if (game.gameState.equals(UInt64.from(2))) {
      // Dealer wins
      await this.acquireFunds(
        gameId,
        game.dealer,
        game.player,
        ProtoUInt64.from(2),
        ProtoUInt64.from(0),
        ProtoUInt64.from(2),
      );
    } else {
      // Tie
      await this.acquireFunds(
        gameId,
        game.player,
        game.dealer,
        ProtoUInt64.from(1),
        ProtoUInt64.from(1),
        ProtoUInt64.from(2),
      );
    }

    await this.activeGameId.set(game.player, UInt64.from(0));
    await this.activeGameId.set(game.dealer, UInt64.from(0));

    await this._onLobbyEnd(gameId, Bool(true));
  }

  @runtimeMethod()
  public async verifyCardSequence(gameId: UInt64, cardSequence: Card[]): Promise<void> {
    const game = await this.games.get(gameId);
    assert(game.isSome, 'Invalid game id');
    assert(game.value.gameState.greaterThan(UInt64.from(0)), 'Game has not ended');

    // Verify the hash of the revealed sequence matches the stored hash
    const revealedHash = Poseidon.hash(cardSequence);
    assert(revealedHash.equals(game.value.cardSequenceHash), 'Hash mismatch');

    // If all checks pass, the card sequence is verified
    console.log('Card sequence verified successfully');
  }
}