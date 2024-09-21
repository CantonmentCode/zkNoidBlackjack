import React, {useContext, useEffect, useState} from 'react';
import Button from '@zknoid/sdk/components/shared/Button';
import Input from '@zknoid/sdk/components/shared/Input';
import {TrendingDown, TrendingUp} from 'lucide-react';
import {Bool, PublicKey, UInt64,} from 'o1js';
import {useNetworkStore} from '@zknoid/sdk/lib/stores/network';
import {useProtokitChainStore} from '@zknoid/sdk/lib/stores/protokitChain';
import {useNotificationStore} from '@zknoid/sdk/components/shared/Notification/lib/notificationStore';
import {ClientAppChain} from 'zknoid-chain-dev';
import {blackjackConfig} from './config';
import ZkNoidGameContext from '@zknoid/sdk/lib/contexts/ZkNoidGameContext';
import GamePage from '@zknoid/sdk/components/framework/GamePage';
import {FullscreenWrap} from "@zknoid/sdk/components/framework/GameWidget/ui/FullscreenWrap";
import { motion } from "framer-motion";


//@ts-ignore
export function UICard({children, className}) {
    return (
        <div
            className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}
        >
            {children}
        </div>
    );
}

//@ts-ignore
export function CardHeader({children, className}) {
    return (
        <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
            {children}
        </div>
    );
}

//@ts-ignore
export function CardContent({children, className}) {
    return (
        <div className={`p-6 ${className}`}>
            {children}
        </div>
    );
}

function BlackjackGame() {
    const {client} = useContext(ZkNoidGameContext);
    const networkStore = useNetworkStore();
    const protokitChain = useProtokitChainStore();
    const notificationStore = useNotificationStore();

    if (!client) {
        throw Error('Context app chain client is not set');
    }

    const client_ = client as ClientAppChain<
        typeof blackjackConfig.runtimeModules,
        any,
        any,
        any
    >;

    const query = networkStore.protokitClientStarted
        ? client_.query.runtime.BlackjackLogic
        : undefined;

    const [bet, setBet] = useState('');
    const [balance, setBalance] = useState(1000);
    const [message, setMessage] = useState('');
    const [playerHand, setPlayerHand] = useState([]);
    const [dealerHand, setDealerHand] = useState([]);
    const [gameResult, setGameResult] = useState('');
    const [actionCounter, setActionCounter] = useState(0);
    const [gameState, setGameState] = useState(0); // 0: ongoing, 1: player won, 2: dealer won, 3: tie
    const [betAmount, setBetAmount] = useState(0);
    const [gameId, setGameId] = useState<UInt64 | null>(null);
    const [cardSequence, setCardSequence] = useState([]);
    const [lobby, setLobby] = useState(null);

    const generateCardSequence = () => {
        const suits = [0, 1, 2, 3]; // Represent suits as numbers
        const values = [...Array(13).keys()].map((i) => i + 1); // Values from 1 to 13
        let deck = [];

        for (let suit of suits) {
            for (let value of values) {
                deck.push({suit: UInt64.from(suit), value: UInt64.from(value)});
            }
        }

        // Shuffle the deck
        deck.sort(() => Math.random() - 0.5);

        return deck;
    };

    const startGame = async () => {
        const numericBet = parseInt(bet);
        if (numericBet > balance || numericBet <= 0 || isNaN(numericBet)) {
            setMessage('Please enter a valid bet amount.');
            return;
        }

        const blackjackLogic = client_.runtime.resolve('BlackjackLogic');

        // Generate card sequence
        const cardSeq = generateCardSequence();

        //@ts-ignore
        setCardSequence(cardSeq);

        // Create a Lobby
        const lobbyId = UInt64.from(Math.floor(Math.random() * 1e12)); // Random lobby ID
        const playerPublicKey = PublicKey.fromBase58(networkStore.address!);
        const dealerPublicKey = PublicKey.empty(); // Using an empty PublicKey as dealer

        const lobbyObject = {
            id: lobbyId,
            players: [playerPublicKey, dealerPublicKey],
            participationFee: UInt64.from(numericBet),
        };

        //@ts-ignore
        setLobby(lobbyObject);

        try {
            // Initialize game
            await blackjackLogic.initGame(lobbyObject, Bool(true));

            // Start blackjack game
            await blackjackLogic.startBlackjackGame(
                lobbyObject,
                Bool(true),
                cardSeq,
            );

            notificationStore.create({
                type: 'success',
                message: 'Game started!',
            });
            setGameResult('');
            setBalance(balance - numericBet);
            setBetAmount(numericBet);
            setBet('');
            setGameId(lobbyId);
            setGameState(1); // Game is ongoing
        } catch (error) {
            notificationStore.create({
                type: 'error',
                message: 'Failed to start game.',
            });
            console.error('Error starting game:', error);
        }

        setActionCounter((prev) => prev + 1);
    };

    const hit = async () => {
        if (!gameId || !cardSequence) {
            setMessage('Game not initialized properly.');
            return;
        }

        const blackjackLogic = client_.runtime.resolve('BlackjackLogic');

        try {
            await blackjackLogic.hit(gameId, cardSequence);

            notificationStore.create({
                type: 'success',
                message: 'Hit successful!',
            });
        } catch (error) {
            notificationStore.create({
                type: 'error',
                message: 'Failed to hit.',
            });
            console.error('Error on hit:', error);
        }

        setActionCounter((prev) => prev + 1);
    };

    const stand = async () => {
        if (!gameId || !cardSequence) {
            setMessage('Game not initialized properly.');
            return;
        }

        const blackjackLogic = client_.runtime.resolve('BlackjackLogic');

        try {
            await blackjackLogic.stand(gameId, cardSequence);

            notificationStore.create({
                type: 'success',
                message: "You stand. Dealer's turn.",
            });
        } catch (error) {
            notificationStore.create({
                type: 'error',
                message: 'Failed to stand.',
            });
            console.error('Error on stand:', error);
        }

        setActionCounter((prev) => prev + 1);
    };

    const doubleDown = async () => {
        if (!gameId || !cardSequence) {
            setMessage('Game not initialized properly.');
            return;
        }

        if (balance < betAmount) {
            setMessage('Not enough balance to double down.');
            return;
        }

        const blackjackLogic = client_.runtime.resolve('BlackjackLogic');

        try {
            await blackjackLogic.doubleDown(gameId, cardSequence);

            notificationStore.create({
                type: 'success',
                message: 'Double down successful!',
            });
            setBalance(balance - betAmount);
            setBetAmount(betAmount * 2);
        } catch (error) {
            notificationStore.create({
                type: 'error',
                message: 'Failed to double down.',
            });
            console.error('Error on double down:', error);
        }

        setActionCounter((prev) => prev + 1);
    };

    const resetGame = () => {
        setBet('');
        setPlayerHand([]);
        setDealerHand([]);
        setGameState(0); // Reset game state
        setMessage('');
        setGameResult('');
        setBetAmount(0);
        setGameId(null);
        setCardSequence([]);
        setLobby(null);
    };


    //@ts-ignore
    const calculateHandValue = (hand) => {
        let value = 0;
        let numAces = 0;

        for (let card of hand) {
            if (card.value === 1) {
                numAces += 1;
                value += 11;
            } else if (card.value > 10) {
                value += 10;
            } else {
                value += card.value;
            }
        }

        while (value > 21 && numAces > 0) {
            value -= 10;
            numAces -= 1;
        }

        return value;
    };

    const fetchGameState = async () => {
        if (!query || !gameId) return;

        try {
            const gameOption = await query.games.get(gameId);
            if (gameOption && gameOption.isSome) {
                const game = gameOption.value;
                setGameState(Number(game.gameState.toBigInt()));

                const gameHandOption = await query.gamesHand.get(gameId);
                if (gameHandOption && gameHandOption.isSome) {
                    const gameHand = gameHandOption.value;

                    // Player hand
                    const playerHandCards = [];
                    for (let i = 0; i < Number(gameHand.playerHand.cardCount.toBigInt()); i++) {
                        const card = gameHand.playerHand.cards[i];
                        playerHandCards.push({
                            suit: Number(card.suit.toBigInt()),
                            value: Number(card.value.toBigInt()),
                        });
                    }

                    //@ts-ignore
                    setPlayerHand(playerHandCards);

                    // Dealer hand
                    const dealerHandCards = [];
                    for (let i = 0; i < Number(gameHand.dealerHand.cardCount.toBigInt()); i++) {
                        const card = gameHand.dealerHand.cards[i];
                        dealerHandCards.push({
                            suit: Number(card.suit.toBigInt()),
                            value: Number(card.value.toBigInt()),
                        });
                    }

                    //@ts-ignore
                    setDealerHand(dealerHandCards);
                }

                // Determine game result
                if (game.gameState.greaterThan(UInt64.from(0))) {
                    const playerScore = calculateHandValue(playerHand);
                    const dealerScore = calculateHandValue(dealerHand);

                    if (game.gameState.equals(UInt64.from(1))) {
                        // Player wins
                        setGameResult('You win!');
                        setBalance(balance + betAmount * 2);
                    } else if (game.gameState.equals(UInt64.from(2))) {
                        // Dealer wins
                        setGameResult('Dealer wins!');
                    } else if (game.gameState.equals(UInt64.from(3))) {
                        // Tie
                        setGameResult("Push! It's a tie!");
                        setBalance(balance + betAmount);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching game state:', error);
        }
    };

    useEffect(() => {
        fetchGameState();
    }, [protokitChain.block?.height, actionCounter, query, gameId]);

    //@ts-ignore
    const renderCard = (card, index, hidden = false) => {
        if (hidden) {
            return (
                <div
                    key={index}
                    className="relative w-24 h-36 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl shadow-lg flex items-center justify-center m-2 transition-all duration-300 ease-in-out transform hover:scale-105 hover:rotate-1 hover:shadow-xl"
                    style={{
                        boxShadow:
                            '0 10px 20px rgba(0, 0, 0, 0.2), 0 6px 6px rgba(0, 0, 0, 0.1)',
                    }}
                >
                    <div className="absolute inset-0 bg-white opacity-20 rounded-xl"></div>
                    <div className="text-white text-5xl transform rotate-6">🂠</div>
                </div>
            );
        }

        const suits = ['♠', '♥', '♦', '♣'];
        const values = {
            1: 'A',
            11: 'J',
            12: 'Q',
            13: 'K',
        };

        //@ts-ignore
        const cardValue = values[card.value] || card.value;
        const cardSuit = suits[card.suit];

        const isRed = card.suit === 1 || card.suit === 2;
        const colorClass = isRed ? 'text-red-500' : 'text-gray-800';
        const gradientClass = isRed
            ? 'from-red-100 to-red-200'
            : 'from-gray-100 to-gray-200';

        return (
            <div
                key={index}
                className={`relative w-24 h-36 bg-gradient-to-br ${gradientClass} rounded-xl shadow-lg flex flex-col items-center justify-between p-2 m-2 ${colorClass} transition-all duration-300 ease-in-out transform hover:scale-105 hover:rotate-1 hover:shadow-xl`}
                style={{
                    boxShadow:
                        '0 10px 20px rgba(0, 0, 0, 0.2), 0 6px 6px rgba(0, 0, 0, 0.1)',
                }}
            >
                <div className="absolute inset-0 bg-white opacity-40 rounded-xl"></div>
                <div className="relative text-2xl font-bold">{cardValue}</div>
                <div className="relative text-5xl transform -rotate-6">
                    {cardSuit}
                </div>
                <div className="relative text-2xl font-bold self-end rotate-180">
                    {cardValue}
                </div>
            </div>
        );
    };

    return (
        <GamePage gameConfig={blackjackConfig}>
               <div
                    className="bg-gradient-to-br from-green-800 to-green-600 min-h-screen flex items-center justify-center p-4 w-full">
                    <UICard
                        className="relative bg-gray-900 bg-opacity-90 p-8 rounded-3xl shadow-2xl text-white w-full max-w-2xl overflow-hidden">
                        <div
                            className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-yellow-400 to-red-500 opacity-20 transform -skew-y-6"></div>
                        <CardContent className="relative z-10">
                            <h1 className="text-5xl font-bold text-center mb-8 text-yellow-400 text-shadow">
                                Blackjack
                            </h1>
                            <div className="mb-8 flex items-center justify-between">
                                <div className="flex items-center bg-gray-800 rounded-full px-4 py-2 shadow-inner">
                                    <span className="text-yellow-400 mr-2 text-3xl">💰</span>
                                    <p className="text-xl">
                                        Balance: <span className="font-bold text-yellow-400">${balance}</span>
                                    </p>
                                </div>
                                {gameState !== 0 && (
                                    <div className="flex items-center bg-gray-800 rounded-full px-4 py-2 shadow-inner">
                                        <p className="text-xl mr-2">Bet:</p>
                                        <div
                                            className="bg-yellow-400 text-gray-900 px-3 py-1 rounded-full font-bold shadow">
                                            ${betAmount}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {gameState === 0 && (
                                <div className="mb-6">
                                    <input
                                        type="number"
                                        className="w-full p-4 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-4 shadow-inner"
                                        placeholder="Enter your bet"
                                        value={bet}
                                        style={{
                                            "color" : "black !important"
                                        }}
                                        //@ts-ignore
                                        onChange={(e) => setBet(e.target.value)}
                                    />
                                    {/*@ts-ignore*/}
                                    <Button
                                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 w-full p-4 rounded-lg hover:from-yellow-500 hover:to-yellow-600 transition duration-200 font-bold text-gray-900 shadow-lg transform hover:scale-105"
                                        onClick={startGame}
                                        label={"Place Bet"}>
                                        Place Bet
                                    </Button>
                                    {message && (
                                        <p className="text-red-500 mt-2 text-center font-semibold">
                                            {message}
                                        </p>
                                    )}
                                </div>
                            )}
                            {gameState !== 0 && (
                                <>
                                    <div className="mb-8 bg-gray-800 bg-opacity-50 rounded-xl p-4 shadow-inner">
                                        <h2 className="text-2xl font-bold mb-4 text-yellow-400 text-shadow">
                                            Dealer's Hand
                                        </h2>
                                        <div className="flex justify-center flex-wrap">
                                            {dealerHand.map((card, index) => {
                                                if (index === 0 && gameState === 1) {
                                                    return renderCard(card, index, true);
                                                } else {
                                                    return renderCard(card, index);
                                                }
                                            })}
                                        </div>
                                        {(gameState > 0) && (
                                            <p className="text-center mt-4 text-xl font-semibold">
                                                Total: {calculateHandValue(dealerHand)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="mb-8 bg-gray-800 bg-opacity-50 rounded-xl p-4 shadow-inner">
                                        <h2 className="text-2xl font-bold mb-4 text-yellow-400 text-shadow">
                                            Your Hand
                                        </h2>
                                        <div className="flex justify-center flex-wrap">
                                            {playerHand.map((card, index) => renderCard(card, index))}
                                        </div>
                                        <p className="text-center mt-4 text-xl font-semibold">
                                            Total: {calculateHandValue(playerHand)}
                                        </p>
                                    </div>
                                    {gameState === 1 && (
                                        <div className="flex justify-around mb-6">
                                            {/*@ts-ignore*/}
                                            <Button
                                                className="bg-gradient-to-r from-green-400 to-green-500 px-6 py-3 rounded-lg hover:from-green-500 hover:to-green-600 transition duration-200 font-bold text-white shadow-lg transform hover:scale-105"
                                                onClick={hit}
                                            >
                                                Hit
                                            </Button>
                                            {/*@ts-ignore*/}
                                            <Button
                                                className="bg-gradient-to-r from-blue-400 to-blue-500 px-6 py-3 rounded-lg hover:from-blue-500 hover:to-blue-600 transition duration-200 font-bold text-white shadow-lg transform hover:scale-105"
                                                onClick={doubleDown}
                                            >
                                                Double
                                            </Button>
                                            {/*@ts-ignore*/}
                                            <Button
                                                className="bg-gradient-to-r from-red-400 to-red-500 px-6 py-3 rounded-lg hover:from-red-500 hover:to-red-600 transition duration-200 font-bold text-white shadow-lg transform hover:scale-105"
                                                onClick={stand}
                                            >
                                                Stand
                                            </Button>
                                        </div>
                                    )}
                                    {gameState > 0 && gameResult && (
                                        <div className="text-center">
                                            <p className="mb-6 text-3xl font-bold">
                                                {gameResult.includes('win') ? (
                                                    <span className="text-green-400 flex items-center justify-center">
                        <TrendingUp className="mr-2"/> {gameResult}
                      </span>
                                                ) : (
                                                    <span className="text-red-400 flex items-center justify-center">
                        <TrendingDown className="mr-2"/> {gameResult}
                      </span>
                                                )}
                                            </p>
                                            {/*@ts-ignore*/}
                                            <Button
                                                className="bg-gradient-to-r from-purple-400 to-purple-500 px-8 py-3 rounded-lg hover:from-purple-500 hover:to-purple-600 transition duration-200 font-bold text-white shadow-lg transform hover:scale-105"
                                                onClick={resetGame}
                                            >
                                                Play Again
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </UICard>
                </div>
        </GamePage>
    );
}

export default BlackjackGame;
