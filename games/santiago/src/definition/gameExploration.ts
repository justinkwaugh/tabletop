import { assert, shuffle, type ExplorationPopulation, type GameExploration } from '@tabletop/common'
import {
    SantiagoGameStateValidator,
    type SantiagoProjectedState,
    HydratedSantiagoGameState
} from '../model/gameState.js'
import { isFieldSquare } from '../model/board.js'
import { buildTileBag } from '../util/tileBag.js'

export class SantiagoGameExploration implements GameExploration<SantiagoProjectedState> {
    createFromCanonicalState(state: SantiagoProjectedState): SantiagoProjectedState {
        assert(state.publicMoney !== false, 'Exploration is unavailable with private money')
        const hydratedState = new HydratedSantiagoGameState(state)
        shuffle(hydratedState.tileBag, hydratedState.getProtectedPrng().random)
        return hydratedState.dehydrate()
    }

    createFromProjectedState({
        game,
        state,
        random
    }: ExplorationPopulation<SantiagoProjectedState>): SantiagoProjectedState {
        assert(
            game.config?.publicMoney !== false && state.publicMoney !== false,
            'Exploration is unavailable with private money'
        )
        const tileBag = buildTileBag()
        const setupDiscardCount = tileBag.length % Math.max(4, state.players.length)
        const visibleTiles = [
            ...state.board.squares.flat().filter(isFieldSquare),
            ...state.revealedTiles
        ]
        for (const tile of visibleTiles) {
            const index = tileBag.findIndex(
                (candidate) =>
                    candidate.crop === tile.crop && candidate.farmerCapacity === tile.farmerCapacity
            )
            assert(index >= 0, 'Visible tiles exceed the starting tile population')
            tileBag.splice(index, 1)
        }
        const remaining = new HydratedSantiagoGameState(state).getRemainingTileCount()
        assert(
            tileBag.length === remaining + setupDiscardCount,
            'Exploration requires all publicly removed tiles'
        )
        shuffle(tileBag, random)
        tileBag.splice(0, setupDiscardCount)
        const result = { ...state, tileBag }
        assert(
            SantiagoGameStateValidator.Check(result),
            'Exploration must produce a complete Santiago state'
        )
        return result
    }
}
