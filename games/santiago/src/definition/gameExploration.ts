import { shuffle, type GameExploration } from '@tabletop/common'
import { SantiagoGameState, HydratedSantiagoGameState } from '../model/gameState.js'

export class SantiagoGameExploration implements GameExploration<SantiagoGameState> {
    createFromCanonicalState(state: SantiagoGameState): SantiagoGameState {
        const hydratedState = new HydratedSantiagoGameState(state)
        shuffle(hydratedState.tileBag, () => Math.random())
        return hydratedState.dehydrate()
    }
}
