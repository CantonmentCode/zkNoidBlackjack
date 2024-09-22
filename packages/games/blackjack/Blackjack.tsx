import React, { useContext, useState, useEffect } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import './BlackjackGame.css';
import GamePage from '@zknoid/sdk/components/framework/GamePage';
import { blackjackConfig } from './config';
import { useNetworkStore } from "@zknoid/sdk/lib/stores/network";
import { ClientAppChain } from "zknoid-chain-dev";
import ZkNoidGameContext from "@zknoid/sdk/lib/contexts/ZkNoidGameContext";
import { useProtokitChainStore } from "@zknoid/sdk/lib/stores/protokitChain";
import { useNotificationStore } from "@zknoid/sdk/components/shared/Notification/lib/notificationStore";
import { Field, Poseidon, PublicKey, UInt32 } from "o1js";

function BlackjackGame() {
  const [balance, setBalance] = useState(1000);
  const [bet, setBet] = useState('');
  const [message, setMessage] = useState('');
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [gameResult, setGameResult] = useState('');
  const [gameState, setGameState] = useState(0); // 0: betting, 1: player turn, 2: dealer turn, 3: game over
  const [deck, setDeck] = useState([]);
  const [drawnCards, setDrawnCards] = useState([]); // New state variable

  const { client } = useContext(ZkNoidGameContext);
  console.log("Context", client);

  if (!client) {
    throw Error("Context app chain client is not set");
  }

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
    ? client_.query.runtime.BlackjackLogic
    : undefined;

  const verifyDeck = async (deck) => {
    const blackjackLogic = client_.runtime.resolve("BlackjackLogic");
  
    const deckValues = deck.map(d => {
      const cardValue = d.suit.mul(100).add(d.value); // UInt32
      return Field(cardValue); 
    });
  
    // Hash the deckValues array into a single Field element
    const deckHash = Poseidon.hash(deckValues);
  
    const tx = await client.transaction(
      PublicKey.fromBase58(networkStore.address!),
      async () => {
        await blackjackLogic.verifyDeck(deckHash);
      },
    );
    await tx.sign();
    await tx.send();
  };

  const signDeck = async (deck) => {
    const blackjackLogic = client_.runtime.resolve("BlackjackLogic");
  
    const deckValues = deck.map(d => {
      const cardValue = d.suit.mul(100).add(d.value); // UInt32
      return Field(cardValue);
    });
  
    // Hash the deckValues array into a single Field element
    const deckHash = Poseidon.hash(deckValues);
  
    const tx = await client.transaction(
      PublicKey.fromBase58(networkStore.address!),
      async () => {
        await blackjackLogic.signDeck(deckHash);
      },
    );
    await tx.sign();
    await tx.send();
  };

  // Map suits and values to UInt32
  const suits = [
    UInt32.from(0), // Spades
    UInt32.from(1), // Hearts
    UInt32.from(2), // Diamonds
    UInt32.from(3)  // Clubs
  ];

  const values = [
    UInt32.from(1),  // A
    UInt32.from(2),
    UInt32.from(3),
    UInt32.from(4),
    UInt32.from(5),
    UInt32.from(6),
    UInt32.from(7),
    UInt32.from(8),
    UInt32.from(9),
    UInt32.from(10),
    UInt32.from(11), // J
    UInt32.from(12), // Q
    UInt32.from(13)  // K
  ];

  // Mapping back to symbols for display
  const suitSymbols = ['♠', '♥', '♦', '♣'];
  const valueSymbols = {
    1: 'A',
    2: '2',
    3: '3',
    4: '4',
    5: '5',
    6: '6',
    7: '7',
    8: '8',
    9: '9',
    10: '10',
    11: 'J',
    12: 'Q',
    13: 'K'
  };

  const initializeDeck = () => {
    let newDeck = [];
    for (let suit of suits) {
      for (let value of values) {
        newDeck.push({ suit, value });
      }
    }
    return shuffleDeck(newDeck);
  };

  const shuffleDeck = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };

  const drawCard = () => {
    if (deck.length <= 1) {
      const newDeck = initializeDeck();
      setDeck(newDeck);
      return newDeck.pop();
    }
    const newDeck = [...deck];
    const card = newDeck.pop();
    setDeck(newDeck);
    setDrawnCards(prevDrawnCards => [...prevDrawnCards, card]); // Update drawnCards
    return card;
  };

  const calculateHandValue = (hand) => {
    let value = 0;
    let aces = 0;
    for (let card of hand) {
      const cardValue = Number(card.value.value.toBigInt());
      if (cardValue === 1) {
        aces += 1;
        value += 11;
      } else if (cardValue >= 11 && cardValue <= 13) {
        value += 10;
      } else {
        value += cardValue;
      }
    }
    while (value > 21 && aces > 0) {
      value -= 10;
      aces -= 1;
    }
    return value;
  };  

  const startGame = async () => {
    const numericBet = parseInt(bet);
    if (numericBet > balance || numericBet <= 0 || isNaN(numericBet)) {
      setMessage('Please enter a valid bet amount.');
      return;
    }
    setBalance(balance - numericBet);
    const newDeck = initializeDeck();

    await signDeck(newDeck);

    setDeck(newDeck);
    setDrawnCards([]); // Reset drawnCards
    setPlayerHand([drawCard(), drawCard()]);
    setDealerHand([drawCard(), drawCard()]);
    setGameState(1);
    setMessage('');
  };

  const hit = async () => {
    const newCard = drawCard();
    const newHand = [...playerHand, newCard];
    setPlayerHand(newHand);
    if (calculateHandValue(newHand) > 21) {
      await endGame(dealerHand, newHand);
    }
  };

  const stand = () => {
    setGameState(2);
  };

  const doubleDown = async () => {
    const numericBet = parseInt(bet);
    if (balance < numericBet) {
      setMessage('Not enough balance to double down.');
      return;
    }
    setBalance(balance - numericBet);
    setBet((prevBet) => (parseInt(prevBet) * 2).toString());
    const newCard = drawCard();
    const newHand = [...playerHand, newCard];
    setPlayerHand(newHand);
    setGameState(2);
    if (calculateHandValue(newHand) > 21) {
      await endGame(dealerHand, newHand);
    }
  };

  const dealerPlay = async () => {
    let newDealerHand = [...dealerHand];
    while (calculateHandValue(newDealerHand) < 17) {
      newDealerHand.push(drawCard());
    }
    setDealerHand(newDealerHand);
    await endGame(newDealerHand, playerHand);
  };

  const endGame = async (endDealerHand, endPlayerHand) => {
    const playerValue = calculateHandValue(endPlayerHand);
    const dealerValue = calculateHandValue(endDealerHand);
    let result = '';
    if (playerValue > 21) {
      result = 'Bust! Dealer wins!';
    } else if (dealerValue > 21 || playerValue > dealerValue) {
      result = 'You win!';
      setBalance(balance + parseInt(bet) * 2);
    } else if (playerValue < dealerValue) {
      result = 'Dealer wins!';
    } else {
      result = "It's a tie!";
      setBalance(balance + parseInt(bet));
    }
    setGameResult(result);
    setGameState(3);

    // Reconstruct the initial deck
    const initialDeck = [...deck, ...drawnCards.slice().reverse()];
    // Verify the deck
    await verifyDeck(initialDeck);
  };

  const resetGame = () => {
    setBet('');
    setPlayerHand([]);
    setDealerHand([]);
    setGameState(0);
    setMessage('');
    setGameResult('');
    setDrawnCards([]); // Reset drawnCards
  };

  useEffect(() => {
    if (gameState === 2) {
      (async () => {
        await dealerPlay();
      })();
    }
  }, [gameState]);

  const renderCard = (card, index, isHidden = false) => {
    const cardValue = Number(card.value.value.toBigInt());
    const cardSuit = Number(card.suit.value.toBigInt());
    const valueSymbol = valueSymbols[cardValue];
    const suitSymbol = suitSymbols[cardSuit];
    return (
      <div key={index} className={`card ${isHidden ? 'hidden-card' : ''}`}>
        {isHidden ? '?' : `${valueSymbol}${suitSymbol}`}
      </div>
    );
  };

  return (
    <GamePage gameConfig={blackjackConfig}>
      <div className="blackjack-game">
        <div className="game-container">
          <h1 className="game-title">Blackjack</h1>
          <div className="game-info">
            <div className="balance">
              <span className="balance-icon">💰</span>
              <p>
                Balance: <span className="balance-amount">${balance}</span>
              </p>
            </div>
            {gameState !== 0 && (
              <div className="current-bet">
                <p>Bet:</p>
                <div className="bet-amount">${bet}</div>
              </div>
            )}
          </div>
          {gameState === 0 && (
            <div className="betting-area">
              <input
                type="number"
                className="bet-input"
                placeholder="Enter your bet"
                value={bet}
                style={{
                  color: "black",
                }}
                onChange={(e) => setBet(e.target.value)}
              />
              <button className="btn bet-btn" onClick={startGame}>
                Place Bet
              </button>
              {message && <p className="error-message">{message}</p>}
            </div>
          )}
          {gameState !== 0 && (
            <div>
              <div className="hand dealer-hand">
                <h2>Dealer's Hand</h2>
                <div className="cards">
                  {dealerHand.map((card, index) =>
                    renderCard(card, index, index === 1 && gameState === 1)
                  )}
                </div>
                {gameState > 1 && (
                  <p className="hand-value">
                    Total: {calculateHandValue(dealerHand)}
                  </p>
                )}
              </div>
              <div className="hand player-hand">
                <h2>Your Hand</h2>
                <div className="cards">
                  {playerHand.map((card, index) => renderCard(card, index))}
                </div>
                <p className="hand-value">
                  Total: {calculateHandValue(playerHand)}
                </p>
              </div>
              {gameState === 1 && (
                <div className="action-buttons">
                  <button className="btn hit-btn" onClick={hit}>
                    Hit
                  </button>
                  <button className="btn double-btn" onClick={doubleDown}>
                    Double
                  </button>
                  <button className="btn stand-btn" onClick={stand}>
                    Stand
                  </button>
                </div>
              )}
              {gameState === 3 && gameResult && (
                <div className="game-result">
                  <p
                    className={`result-message ${
                      gameResult.includes('win') ? 'win' : 'lose'
                    }`}
                  >
                    {gameResult.includes('win') ? (
                      <span>
                        <TrendingUp /> {gameResult}
                      </span>
                    ) : (
                      <span>
                        <TrendingDown /> {gameResult}
                      </span>
                    )}
                  </p>
                  <button className="btn play-again-btn" onClick={resetGame}>
                    Play Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </GamePage>
  );
}

export default BlackjackGame;
