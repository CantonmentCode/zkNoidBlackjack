import { UInt64 } from '@proto-kit/library';
import { ArkanoidGameHub } from './games/arkanoid/ArkanoidGameHub';
import { RandzuLogic } from './games/randzu/RandzuLogic';
import { ThimblerigLogic } from './games/thimblerig/ThimblerigLogic';
import { Balances } from './framework';
import { ModulesConfig } from '@proto-kit/common';
import { CheckersLogic } from './games/checkers';
import { GuessGame } from './games/number_guessing';
import { BlackjackLogic } from './games/blackjack';

const modules = {
  ArkanoidGameHub,
  ThimblerigLogic,
  Balances,
  RandzuLogic,
  CheckersLogic,
  GuessGame,
  BlackjackLogic,
};

const config: ModulesConfig<typeof modules> = {
  ArkanoidGameHub: {},
  ThimblerigLogic: {},
  Balances: {
    totalSupply: UInt64.from(10000),
  },
  RandzuLogic: {},
  CheckersLogic: {},
  GuessGame: {},
  BlackjackLogic: {},
};

export default {
  modules,
  config,
};
