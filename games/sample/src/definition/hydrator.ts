import {
    GameAction,
    type GameHydrator,
    type HydratedAction
} from '@tabletop/common'
import { HydratedAddAmount, isAddAmount } from '../actions/addAmount.js'
import { HydratedSampleGameState, SampleGameState } from '../model/gameState.js'
import { HydratedPass, isPass } from '../actions/pass.js'

// This is essentially a factory that knows how to take raw action and state data
// and return the correct hydrated class instances for the Sample game.  Used by the game engine
export class SampleHydrator
    implements GameHydrator<SampleGameState, HydratedSampleGameState>
{
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isAddAmount(data): {
                return new HydratedAddAmount(data)
            }
            case isPass(data): {
                return new HydratedPass(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: SampleGameState): HydratedSampleGameState {
        return new HydratedSampleGameState(state)
    }
}
