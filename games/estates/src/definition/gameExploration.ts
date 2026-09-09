import {
    assert,
    assertExists,
    type ExplorationPopulation,
    type GameExploration
} from '@tabletop/common'
import {
    EstatesGameStateValidator,
    type EstatesProjectedState,
    HydratedEstatesGameState
} from '../model/gameState.js'
import { HydratedRoofBag } from '../components/roofBag.js'
import { isDrawRoof } from '../actions/drawRoof.js'

export class EstatesGameExploration implements GameExploration<EstatesProjectedState> {
    createFromCanonicalState(state: EstatesProjectedState): EstatesProjectedState {
        assert(!state.hiddenMoney, 'Exploration is unavailable with Hidden Money')
        const hydratedState = new HydratedEstatesGameState(state)
        hydratedState.roofs.shuffle(hydratedState.getProtectedPrng().random)
        return hydratedState.dehydrate()
    }

    createFromProjectedState({
        game,
        state,
        actions,
        random
    }: ExplorationPopulation<EstatesProjectedState>): EstatesProjectedState {
        assert(
            !game.config?.hiddenMoney && !state.hiddenMoney,
            'Exploration is unavailable with Hidden Money'
        )
        const roofs = HydratedRoofBag.create(random)
        for (const action of actions) {
            if (!isDrawRoof(action)) continue
            assertExists(action.metadata, 'Exploration requires revealed roof draws')
            const index = roofs.items.findIndex(
                (roof) => roof.value === action.metadata?.chosenRoof.value
            )
            assert(index >= 0, 'Revealed roofs exceed the starting roof population')
            roofs.items.splice(index, 1)
        }
        assert(
            roofs.items.length === state.roofs.remaining,
            'Exploration roof count does not match the source'
        )
        roofs.remaining = roofs.items.length
        roofs.shuffle(random)
        const sample = new HydratedEstatesGameState({ ...state, roofs: roofs.dehydrate() })
        const result = sample.dehydrate()
        assert(
            EstatesGameStateValidator.Check(result),
            'Exploration must produce a complete Estates state'
        )
        return result
    }
}
