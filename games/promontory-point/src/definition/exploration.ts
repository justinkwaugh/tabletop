import { assert, shuffle, type ExplorationPopulation, type GameExploration } from '@tabletop/common'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { TRACK_PIECES_PER_RAILROAD } from '../components/trackPieces.js'
import {
    HydratedPromontoryPointGameState,
    PromontoryPointGameStateValidator,
    type PromontoryPointGameState,
    type PromontoryPointProjectedState
} from '../model/gameState.js'
import { keptPieces } from '../model/playerState.js'

export class PromontoryPointGameExploration implements GameExploration<PromontoryPointProjectedState> {
    // R-5: a branch of the real game keeps every hand and reshuffles only the bag, from the
    // branch's own protected stream.
    createFromCanonicalState(state: PromontoryPointProjectedState): PromontoryPointProjectedState {
        const hydrated = new HydratedPromontoryPointGameState(structuredClone(state))
        hydrated.bag.shuffle(hydrated.getProtectedPrng().random)
        const result = hydrated.dehydrate()
        assert(
            PromontoryPointGameStateValidator.Check(result),
            'Exploration must start from a complete Promontory Point state'
        )
        return result
    }

    // R-5, R-6.3-H2: everything the projection names is kept, kept pieces and the explorer's own
    // hand among it. The pieces it does not name are dealt afresh from the branch's randomness:
    // each unseen hand its public count, and the bag the rest.
    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<PromontoryPointProjectedState>): PromontoryPointGameState {
        const unseen = this.unseenPieces(state)
        shuffle(unseen, random)
        const players = state.players.map((player) => ({
            ...player,
            hand: player.hand ?? unseen.splice(0, player.handCount)
        }))
        players.forEach((player) =>
            assert(
                player.hand.length === player.handCount,
                'Exploration holds too few unseen pieces for the hands'
            )
        )
        assert(
            unseen.length === state.bag.remaining,
            'Exploration piece count does not match the bag'
        )
        const result = { ...state, players, bag: { items: unseen, remaining: unseen.length } }
        delete result.masterSeed
        assert(
            PromontoryPointGameStateValidator.Check(result),
            'Exploration must produce a complete Promontory Point state'
        )
        return result
    }

    // R-1.1, R-5: per railroad, 24 less the pieces on the board, scrapped, revealed this turn, kept,
    // and in the hands the projection shows; listed in a fixed order, so hidden values never reach it.
    private unseenPieces(state: PromontoryPointProjectedState): RailroadId[] {
        const seen: RailroadId[] = [
            ...Object.values(state.track),
            ...(state.turn?.pieces ?? []),
            ...state.players.flatMap((player) => [...(player.hand ?? []), ...keptPieces(player)])
        ]
        return RAILROAD_IDS.flatMap((railroadId) => {
            const count =
                TRACK_PIECES_PER_RAILROAD -
                state.scrapped[railroadId] -
                seen.filter((piece) => piece === railroadId).length
            assert(count >= 0, `More ${railroadId} pieces are in sight than exist`)
            return Array.from({ length: count }, () => railroadId)
        })
    }
}
