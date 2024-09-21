import { runtimeModule, RuntimeModule } from '@proto-kit/module';
import {
  Field,
  Poseidon,
  PublicKey,
} from 'o1js';
import { State, StateMap, assert } from '@proto-kit/protocol';
import { state, runtimeMethod } from '@proto-kit/module';
import { UInt64 } from '@proto-kit/library';

interface BlackjackConfig {}

@runtimeModule()
export class BlackjackLogic extends RuntimeModule<BlackjackConfig> {
  @state() deckHash = State.from<Field>(Field);

  @runtimeMethod()
  async signDeck(deck: Field) {
    await this.deckHash.set(Poseidon.hash([deck]));
  }

  @runtimeMethod()
  async verifyDeck(deck: Field)
 {
    let committedDeck = await this.deckHash.get();
    assert(committedDeck.value.equals(Poseidon.hash([deck])), 'Deck did not match the initial deck! Someone tampered with the data');
  }
}