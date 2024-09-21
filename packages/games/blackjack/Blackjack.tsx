import React, {useContext, useState, useEffect } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import './BlackjackGame.css';
import GamePage from '@zknoid/sdk/components/framework/GamePage';
import { FullscreenWrap } from '@zknoid/sdk/components/framework/GameWidget/ui/FullscreenWrap';
import { blackjackConfig } from './config';
// import {numberConfig} from '../number_guessing/config'
import { useNetworkStore } from "@zknoid/sdk/lib/stores/network";
import { ClientAppChain } from "zknoid-chain-dev";
import ZkNoidGameContext from "@zknoid/sdk/lib/contexts/ZkNoidGameContext";
import { useProtokitChainStore } from "@zknoid/sdk/lib/stores/protokitChain";
import { useNotificationStore } from "@zknoid/sdk/components/shared/Notification/lib/notificationStore";
import { Field, Poseidon, PublicKey, UInt64 } from "o1js";




function BlackjackGame() {
    const [balance, setBalance] = useState(1000);
    const [bet, setBet] = useState('');
    const [message, setMessage] = useState('');
    const [playerHand, setPlayerHand] = useState([]);
    const [dealerHand, setDealerHand] = useState([]);
    const [gameResult, setGameResult] = useState('');
    const [gameState, setGameState] = useState(0); // 0: betting, 1: player turn, 2: dealer turn, 3: game over
    const [deck, setDeck] = useState([]);


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
  
    const verifyDeck = async (deck: object[]) => {
      const blackjackLogic = client_.runtime.resolve("BlackjackLogic");
      
      //@ts-ignore
      const deckString = deck.map(d => d.suit  + d.value).join("-")
  
      const tx = await client.transaction(
        PublicKey.fromBase58(networkStore.address!),
        async () => {
          const signVal = Field.fromValue(BigInt(1))
          await blackjackLogic.verifyDeck(signVal);
        },
      );
        await tx.sign();
        await tx.send();
    };
  
    const signDeck = async (deck: object[]) => {
      const blackjackLogic = client_.runtime.resolve("BlackjackLogic");
      
      //@ts-ignore
      const deckString : string = deck.map(d => d.suit  + d.value).join("-")
  
      const tx = await client.transaction(
        PublicKey.fromBase58(networkStore.address!),
        async () => {
          
          const signVal = Field.fromValue(BigInt(1))

          await blackjackLogic.signDeck(signVal);
        },
      );
        await tx.sign();
        await tx.send();
      
    };
  

    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    //@ts-ignore
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
        return card;
    };

    const calculateHandValue = (hand) => {
        let value = 0;
        let aces = 0;
        for (let card of hand) {
            if (card.value === 'A') {
                aces += 1;
                value += 11;
            } else if (['K', 'Q', 'J'].includes(card.value)) {
                value += 10;
            } else {
                value += parseInt(card.value);
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

        await signDeck(newDeck)
        
        setDeck(newDeck);
        setPlayerHand([drawCard(), drawCard()]);
        setDealerHand([drawCard(), drawCard()]);
        setGameState(1);
        setMessage('');

    };

    const hit = () => {
        const newCard = drawCard();
        const newHand = [...playerHand, newCard];
        setPlayerHand(newHand);
        if (calculateHandValue(newHand) > 21) {
            endGame(dealerHand, newHand);
        }
    };

    const stand = () => {
        setGameState(2);
    };

    const doubleDown = () => {
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
    };

    const dealerPlay = () => {
        let newDealerHand = [...dealerHand];
        while (calculateHandValue(newDealerHand) < 17) {
            newDealerHand.push(drawCard());
        }
        setDealerHand(newDealerHand);
        endGame(newDealerHand, playerHand);
    };

    const endGame = (endDealerHand, endPlayerHand) => {
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
        // verifyDeck(deck)
    };

    const resetGame = () => {
        setBet('');
        setPlayerHand([]);
        setDealerHand([]);
        setGameState(0);
        setMessage('');
        setGameResult('');
    };

    useEffect(() => {
        if (gameState === 2) {
            dealerPlay();
        }
    }, [gameState]);

    const renderCard = (card, index, isHidden = false) => (
      <div
          key={index}
          className={`card ${isHidden ? 'hidden-card' : ''}`}
      >
          {isHidden ? '?' : `${card.value}${card.suit}`}
      </div>
  );
  

  return (
    <GamePage gameConfig={blackjackConfig}>
       <div className="blackjack-game">
            <div className="game-container">
                <h1 className="game-title">Blockjack</h1>
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
                              "color" : "black"
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
                                {dealerHand.map((card, index) => renderCard(card, index, index === 1 && gameState === 1))}
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
                                <button className="btn hit-btn" onClick={hit}>Hit</button>
                                <button className="btn double-btn" onClick={doubleDown}>Double</button>
                                <button className="btn stand-btn" onClick={stand}>Stand</button>
                            </div>
                        )}
                        {gameState === 3 && gameResult && (
                            <div className="game-result">
                                <p className={`result-message ${gameResult.includes('win') ? 'win' : 'lose'}`}>
                                    {gameResult.includes('win') ? (
                                        <span><TrendingUp /> {gameResult}</span>
                                    ) : (
                                        <span><TrendingDown /> {gameResult}</span>
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