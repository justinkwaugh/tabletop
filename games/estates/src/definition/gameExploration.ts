import { type GameExploration } from '@tabletop/common'
import { EstatesGameState, HydratedEstatesGameState } from '../model/gameState.js'

export class EstatesGameExploration implements GameExploration<EstatesGameState> {
    createFromCanonicalState(state: EstatesGameState): EstatesGameState {
        const hydratedState = new HydratedEstatesGameState(state)
        hydratedState.roofs.shuffle()
        return hydratedState.dehydrate()
    }
}
