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

const MAX_CARD_LENGTH = 10

export class Card extends Struct({
  suit: UInt64,
  value: UInt64,
}) {
}

export class Hand extends Struct({
  cards: [Card, Card, Card, Card, Card], // Max 5 cards per hand
  cardCount: UInt64,
}) {}

export class GameInfo extends Struct({
  player: PublicKey,
  dealer: PublicKey,
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

export class CardList extends Struct({
  cards: Provable.Array(Card, MAX_CARD_LENGTH),
}) {}

@runtimeModule()
export class BlackjackLogic extends MatchMaker {
  @state() public games = StateMap.from<UInt64, GameInfo>(UInt64, GameInfo);
  @state() public gamesNum = State.from<UInt64>(UInt64);
  @state() public gamesHand = StateMap.from<UInt64, GameHand>(UInt64, GameHand);

  public override async initGame(
      lobby: Lobby,
      shouldUpdate: Bool
  ): Promise<UInt64> {
    const currentGameId = lobby.id;

    await this.games.set(
        Provable.if(shouldUpdate, currentGameId, UInt64.from(0)),
        new GameInfo({
          player: lobby.players[0],
          dealer: lobby.players[1],
          currentTurn: lobby.players[0],
          lastMoveBlockHeight: this.network.block.height,
          bet: lobby.participationFee,
          gameState: UInt64.from(0),
        })
    );

    await this.gameFund.set(
        currentGameId,
        ProtoUInt64.from(lobby.participationFee)
    );

    return await super.initGame(lobby, shouldUpdate);
  }

  @runtimeMethod()
  public async startBlackjackGame(
      lobby: Lobby,
      shouldUpdate: Bool,
      cardSequence: CardList,
  ): Promise<Void> {
    const currentGameId = lobby.id;
    const initialPlayerHand = new Hand({
      cards: [
        cardSequence.cards[0],
        cardSequence.cards[1],
        Card.empty(),
        Card.empty(),
        Card.empty(),
      ],
      cardCount: UInt64.from(2),
    });

    const initialDealerHand = new Hand({
      cards: [
        cardSequence.cards[2],
        cardSequence.cards[3],
        Card.empty(),
        Card.empty(),
        Card.empty(),
      ],
      cardCount: UInt64.from(2),
    });

    const cardSequenceHash = Poseidon.hash(cardSequence.cards.map((card) => card.value.toFields()[0]));

    await this.gamesHand.set(
        Provable.if(shouldUpdate, currentGameId, UInt64.from(0)),
        new GameHand({
          playerHand: initialPlayerHand,
          dealerHand: initialDealerHand,
          cardSequenceHash: cardSequenceHash,
          currentCardIndex: UInt64.from(4),
        })
    );

    return;
  }

  private drawCard(cardSequence: CardList, currentCardIndex: UInt64): Card {
    const maxCards = cardSequence.cards.length;
    let selectedCard = Card.empty();
  
    for (let i = 0; i < maxCards; i++) {
      const isCurrentIndex = currentCardIndex.equals(UInt64.from(i));

      //@ts-ignore
      selectedCard = Provable.if(isCurrentIndex, cardSequence.cards[i], selectedCard);
    }
  
    assert(
      currentCardIndex.lessThan(UInt64.from(maxCards)),
      'No more cards in the sequence'
    );
  
    return selectedCard;
  }
  

  private calculateHandValue(hand: Hand): UInt64 {
    let total = UInt64.from(0);
    let aceCount = UInt64.from(0);
    const maxCards = 5;
  
    for (let i = 0; i < maxCards; i++) {
      const inHand = hand.cardCount.greaterThan(UInt64.from(i));
      const card = hand.cards[i];
  
      const value = card.value;
      const isAce = value.equals(UInt64.from(1));
      const isFaceCard = value.greaterThan(UInt64.from(10));
  
      const cardValue = Provable.if(
        isFaceCard,
        UInt64.from(10),
        Provable.if(isAce, UInt64.from(0), value)
      );
  
      total = Provable.if(inHand, total.add(cardValue), total);
      aceCount = Provable.if(inHand.and(isAce), aceCount.add(UInt64.from(1)), aceCount);
    }
  
    // Handle Aces
    for (let i = 0; i < maxCards; i++) {
      const hasAceLeft = aceCount.greaterThan(UInt64.from(i));
      const totalWith11 = total.add(UInt64.from(11));
      const canUse11 = totalWith11.lessThanOrEqual(UInt64.from(21));
  
      total = Provable.if(
        hasAceLeft,
        Provable.if(canUse11, totalWith11, total.add(UInt64.from(1))),
        total
      );
    }
  
    return total;
  }
  

  @runtimeMethod()
  public async hit(gameId: UInt64, cardSequence: CardList): Promise<void> {
    const gameOption = await this.games.get(gameId);
    assert(gameOption.isSome, 'Invalid game id');
    const game = gameOption.value;
    assert(game.gameState.equals(UInt64.from(0)), 'Game has ended');
    assert(
        game.currentTurn.equals(game.player),
        "Not player's turn"
    );

    const gameHandOption = await this.gamesHand.get(gameId);
    assert(gameHandOption.isSome, 'Game hand not found');
    const gameHand = gameHandOption.value;

    const playerHand = gameHand.playerHand;
    const currentCardIndex = gameHand.currentCardIndex;

    const newCard = this.drawCard(cardSequence, currentCardIndex);
    const maxCards = 5;

    for (let i = 0; i < maxCards; i++) {
      const isCurrentIndex = playerHand.cardCount.equals(UInt64.from(i));

      //@ts-ignore
      playerHand.cards[i] = Provable.if(isCurrentIndex, newCard, playerHand.cards[i]);
    }

    playerHand.cardCount = playerHand.cardCount.add(UInt64.from(1));


    const handValue = this.calculateHandValue(playerHand);

    gameHand.playerHand = playerHand;
    gameHand.currentCardIndex = currentCardIndex.add(UInt64.from(1));
    game.lastMoveBlockHeight = this.network.block.height;

    if (handValue.greaterThan(UInt64.from(21))) {
      game.gameState = UInt64.from(2); // Dealer wins
      await this.endGame(gameId, game, gameHand);
    } else if (
        handValue.equals(UInt64.from(21)) ||
        playerHand.cardCount.equals(UInt64.from(5))
    ) {
      game.currentTurn = game.dealer;
      await this.games.set(gameId, game);
      await this.gamesHand.set(gameId, gameHand);
      await this.dealerPlay(gameId, cardSequence);
    } else {
      await this.games.set(gameId, game);
      await this.gamesHand.set(gameId, gameHand);
    }
  }

  @runtimeMethod()
  public async stand(gameId: UInt64, cardSequence: CardList): Promise<void> {
    const gameOption = await this.games.get(gameId);
    assert(gameOption.isSome, 'Invalid game id');
    const game = gameOption.value;
    assert(game.gameState.equals(UInt64.from(0)), 'Game has ended');
    assert(
        game.currentTurn.equals(game.player),
        "Not player's turn"
    );

    game.currentTurn = game.dealer;
    game.lastMoveBlockHeight = this.network.block.height;

    await this.games.set(gameId, game);
    await this.dealerPlay(gameId, cardSequence);
  }

  @runtimeMethod()
  public async doubleDown(
      gameId: UInt64,
      cardSequence: CardList
  ): Promise<void> {
    const gameOption = await this.games.get(gameId);
    assert(gameOption.isSome, 'Invalid game id');
    const game = gameOption.value;
    assert(game.gameState.equals(UInt64.from(0)), 'Game has ended');
    assert(
        game.currentTurn.equals(game.player),
        "Not player's turn"
    );

    const gameHandOption = await this.gamesHand.get(gameId);
    assert(gameHandOption.isSome, 'Game hand not found');
    const gameHand = gameHandOption.value;

    const playerHand = gameHand.playerHand;
    assert(
        playerHand.cardCount.equals(UInt64.from(2)),
        'Can only double down on initial hand'
    );

    game.bet = game.bet.mul(2);
    await this.gameFund.set(gameId, ProtoUInt64.from(game.bet));

    const currentCardIndex = gameHand.currentCardIndex;
    const newCard = this.drawCard(cardSequence, currentCardIndex);

    playerHand.cards[2] = newCard;
    playerHand.cardCount = UInt64.from(3);

    gameHand.playerHand = playerHand;
    gameHand.currentCardIndex = currentCardIndex.add(UInt64.from(1));
    game.currentTurn = game.dealer;
    game.lastMoveBlockHeight = this.network.block.height;

    await this.games.set(gameId, game);
    await this.gamesHand.set(gameId, gameHand);
    await this.dealerPlay(gameId, cardSequence);
  }

  @runtimeMethod()
  private async dealerPlay(
      gameId: UInt64,
      cardSequence: CardList
  ): Promise<void> {
    const gameOption = await this.games.get(gameId);
    assert(gameOption.isSome, 'Invalid game id');
    const game = gameOption.value;

    const gameHandOption = await this.gamesHand.get(gameId);
    assert(gameHandOption.isSome, 'Game hand not found');
    const gameHand = gameHandOption.value;

    let dealerHand = gameHand.dealerHand;
    let dealerValue = this.calculateHandValue(dealerHand);
    let currentCardIndex = gameHand.currentCardIndex;

    const maxCards = 5; // Assuming max 5 cards in hand

    while (
        dealerValue.lessThan(UInt64.from(17)) &&
        dealerHand.cardCount.lessThan(UInt64.from(maxCards))
    ) {
      const newCard = this.drawCard(cardSequence, currentCardIndex);

      // Update dealerHand.cards using fixed-size loop and Provable.if
      for (let i = 0; i < maxCards; i++) {
        const isCurrentIndex = dealerHand.cardCount.equals(UInt64.from(i));
        //@ts-ignore
        dealerHand.cards[i] = Provable.if(isCurrentIndex, newCard, dealerHand.cards[i]);
      }

      dealerHand.cardCount = dealerHand.cardCount.add(UInt64.from(1));
      dealerValue = this.calculateHandValue(dealerHand);
      currentCardIndex = currentCardIndex.add(UInt64.from(1));
    }

    gameHand.dealerHand = dealerHand;
    gameHand.currentCardIndex = currentCardIndex;
    game.lastMoveBlockHeight = this.network.block.height;

    const playerValue = this.calculateHandValue(gameHand.playerHand);

    if (
        dealerValue.greaterThan(UInt64.from(21)) ||
        playerValue.greaterThan(dealerValue)
    ) {
      game.gameState = UInt64.from(1); // Player wins
    } else if (dealerValue.greaterThan(playerValue)) {
      game.gameState = UInt64.from(2); // Dealer wins
    } else {
      game.gameState = UInt64.from(3); // Tie
    }

    await this.games.set(gameId, game);
    await this.gamesHand.set(gameId, gameHand);
    await this.endGame(gameId, game, gameHand);
  }


  private async endGame(
      gameId: UInt64,
      game: GameInfo,
      gameHand: GameHand
  ): Promise<void> {
    if (game.gameState.equals(UInt64.from(1))) {
      // Player wins
      await this.acquireFunds(
          gameId,
          game.player,
          game.dealer,
          ProtoUInt64.from(2),
          ProtoUInt64.from(0),
          ProtoUInt64.from(2)
      );
    } else if (game.gameState.equals(UInt64.from(2))) {
      // Dealer wins
      await this.acquireFunds(
          gameId,
          game.dealer,
          game.player,
          ProtoUInt64.from(2),
          ProtoUInt64.from(0),
          ProtoUInt64.from(2)
      );
    } else {
      // Tie
      await this.acquireFunds(
          gameId,
          game.player,
          game.dealer,
          ProtoUInt64.from(1),
          ProtoUInt64.from(1),
          ProtoUInt64.from(2)
      );
    }

    await this.activeGameId.set(game.player, UInt64.from(0));
    await this.activeGameId.set(game.dealer, UInt64.from(0));


    await this._onLobbyEnd(gameId, Bool(true));
  }

  @runtimeMethod()
  public async verifyCardSequence(
      gameId: UInt64,
      cardSequence: CardList
  ): Promise<void> {
    const gameHandOption = await this.gamesHand.get(gameId);
    assert(gameHandOption.isSome, 'Game hand not found');
    const gameHand = gameHandOption.value;

    const gameOption = await this.games.get(gameId);
    assert(gameOption.isSome, 'Invalid game id');
    const game = gameOption.value;

    assert(
        game.gameState.greaterThan(UInt64.from(0)),
        'Game has not ended'
    );

    // Verify the hash of the revealed sequence matches the stored hash
    const revealedHash = Poseidon.hash(cardSequence.cards.map((card) => card.value.toFields()[0]));
    assert(
        revealedHash.equals(gameHand.cardSequenceHash),
        'Hash mismatch'
    );

    // If all checks pass, the card sequence is verified
    console.log('Card sequence verified successfully');
  }
}
