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
  async signDeck(deckHash: Field) {
    await this.deckHash.set(deckHash); 
  }

  @runtimeMethod()
  async verifyDeck(deckHash: Field) {
    let committedDeckHash = await this.deckHash.get();
    assert(
      committedDeckHash.value.equals(deckHash),
      'Deck did not match the initial deck! Someone tampered with the data'
    );
  }
}