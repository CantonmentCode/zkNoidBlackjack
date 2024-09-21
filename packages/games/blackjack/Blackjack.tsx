import React, { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


function BlackjackGame() {
    const [balance, setBalance] = useState(1000);
    const [bet, setBet] = useState('');
    const [message, setMessage] = useState('');
    const [playerHand, setPlayerHand] = useState([]);
    const [dealerHand, setDealerHand] = useState([]);
    const [gameResult, setGameResult] = useState('');
    const [gameState, setGameState] = useState(0); // 0: betting, 1: player turn, 2: dealer turn, 3: game over
    const [deck, setDeck] = useState([]);

    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

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

    const startGame = () => {
        const numericBet = parseInt(bet);
        if (numericBet > balance || numericBet <= 0 || isNaN(numericBet)) {
            setMessage('Please enter a valid bet amount.');
            return;
        }
        setBalance(balance - numericBet);
        const newDeck = initializeDeck();
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
        console.log("masuk anjing")
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
        console.log(playerValue, dealerValue)
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
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
        className={`w-16 h-24 m-1 rounded-lg shadow-lg flex items-center justify-center text-xl font-bold
          ${isHidden ? 'bg-gray-700' : 'bg-white text-gray-900'}`}
      >
        {isHidden ? '?' : `${card.value}${card.suit}`}
      </motion.div>
    );
    
    function Card({ children, className }) {
      return (
        <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
          {children}
        </div>
      );
    }
    
    function CardContent({ children, className }) {
      return (
        <div className={`p-6 ${className}`}>
          {children}
        </div>
      );
    }
    
    function Button({ onClick, children, className }) {
      return (
        <button
          className={`px-4 py-2 rounded-lg font-bold text-white shadow-lg transform hover:scale-105 transition duration-200 ${className}`}
          onClick={onClick}
        >
          {children}
        </button>
      );
    }
    

    return (
      <div className="bg-gradient-to-br from-green-900 to-green-700 min-h-screen flex items-center justify-center p-4 overflow-hidden">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 bg-green-500 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <Card className="relative bg-gray-900 bg-opacity-90 p-8 rounded-3xl shadow-2xl text-white w-full max-w-2xl overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-yellow-400 to-red-500 opacity-20"
            animate={{
              rotate: [0, 360],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
          />
          <CardContent className="relative z-10">
            <motion.h1
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-5xl font-bold text-center mb-8 text-yellow-400"
            >
              Blackjack
            </motion.h1>
            <div className="mb-8 flex items-center justify-between">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center bg-gray-800 rounded-full px-4 py-2 shadow-inner"
              >
                <span className="text-yellow-400 mr-2 text-3xl">💰</span>
                <p className="text-xl">
                  Balance: <span className="font-bold text-yellow-400">${balance}</span>
                </p>
              </motion.div>
              {gameState !== 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center bg-gray-800 rounded-full px-4 py-2 shadow-inner"
                >
                  <p className="text-xl mr-2">Bet:</p>
                  <div className="bg-yellow-400 text-gray-900 px-3 py-1 rounded-full font-bold shadow">
                    ${bet}
                  </div>
                </motion.div>
              )}
            </div>
            <AnimatePresence>
              {gameState === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                  className="mb-6"
                >
                  <input
                    type="number"
                    className="w-full p-4 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-4 shadow-inner"
                    placeholder="Enter your bet"
                    value={bet}
                    onChange={(e) => setBet(e.target.value)}
                  />
                  <Button
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 w-full p-4 rounded-lg hover:from-yellow-500 hover:to-yellow-600 transition-all duration-300"
                    onClick={startGame}
                  >
                    Place Bet
                  </Button>
                  {message && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-red-500 mt-2 text-center font-semibold"
                    >
                      {message}
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {gameState !== 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="mb-8 bg-gray-800 bg-opacity-50 rounded-xl p-4 shadow-inner">
                    <h2 className="text-2xl font-bold mb-4 text-yellow-400">Dealer's Hand</h2>
                    <div className="flex justify-center flex-wrap">
                      {dealerHand.map((card, index) => renderCard(card, index, index === 1 && gameState === 1))}
                    </div>
                    {gameState > 1 && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center mt-4 text-xl font-semibold"
                      >
                        Total: {calculateHandValue(dealerHand)}
                      </motion.p>
                    )}
                  </div>
                  <div className="mb-8 bg-gray-800 bg-opacity-50 rounded-xl p-4 shadow-inner">
                    <h2 className="text-2xl font-bold mb-4 text-yellow-400">Your Hand</h2>
                    <div className="flex justify-center flex-wrap">
                      {playerHand.map((card, index) => renderCard(card, index))}
                    </div>
                    <p className="text-center mt-4 text-xl font-semibold">
                      Total: {calculateHandValue(playerHand)}
                    </p>
                  </div>
                  {gameState === 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-around mb-6"
                    >
                      <Button
                        className="bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 transition-all duration-300"
                        onClick={hit}
                      >
                        Hit
                      </Button>
                      <Button
                        className="bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 transition-all duration-300"
                        onClick={doubleDown}
                      >
                        Double
                      </Button>
                      <Button
                        className="bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 transition-all duration-300"
                        onClick={stand}
                      >
                        Stand
                      </Button>
                    </motion.div>
                  )}
                  {gameState === 3 && gameResult && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center"
                    >
                      <p className="mb-6 text-3xl font-bold">
                        {gameResult.includes('win') ? (
                          <span className="text-green-400 flex items-center justify-center">
                            <TrendingUp className="mr-2" /> {gameResult}
                          </span>
                        ) : (
                          <span className="text-red-400 flex items-center justify-center">
                            <TrendingDown className="mr-2" /> {gameResult}
                          </span>
                        )}
                      </p>
                      <Button
                        className="bg-gradient-to-r from-purple-400 to-purple-500 px-8 py-3 hover:from-purple-500 hover:to-purple-600 transition-all duration-300"
                        onClick={resetGame}
                      >
                        Play Again
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    );
}

export default BlackjackGame;