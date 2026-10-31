import { assertExists, type Game, type GameAction } from '@tabletop/common'
import type * as Type from 'typebox'
import { BOARD_GRID, BoardNodeKind, type SpaceId } from '../components/board.js'
import type { RailroadId } from '../components/railroads.js'
import { PlaceTrack } from '../actions/placeTrack.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { openSpaceIds } from '../rules/network.js'
import { canonical, engine } from './startGame.js'
import { action, turnPlayer } from './turns.js'

export type Played = {
    processedActions: GameAction[]
    // The state after each processed action of the cascade, in order.
    states: PromontoryPointGameState[]
    state: PromontoryPointGameState
}

// One user action through the real engine, with its whole System Action cascade.
export function play<T extends Type.TSchema>(
    game: Game,
    state: PromontoryPointGameState,
    schema: T,
    fields: Partial<Type.Static<T>>
): Played {
    const { processedActions, actionCascade, updatedState } = engine.executeCanonicalAction({
        action: action(schema, state, fields),
        state,
        game
    })
    return {
        processedActions,
        states: actionCascade.transitions.map(({ after }) => canonical(after)),
        state: canonical(updatedState)
    }
}

// The action types each seat is offered, by player id.
export function offered(game: Game, state: PromontoryPointGameState): Record<string, string[]> {
    return Object.fromEntries(
        state.turnManager.turnOrder.map((playerId) => [
            playerId,
            engine.getValidActionTypesForPlayer(game, state, playerId)
        ])
    )
}

// An open space with no town on it, so placing there resolves nothing.
export function openCountryFor(state: PromontoryPointGameState, railroadId: RailroadId): SpaceId {
    const spaceId = openSpaceIds(state.track, railroadId).find(
        (candidate) => BOARD_GRID.requireSpace(candidate).kind === BoardNodeKind.Empty
    )
    assertExists(spaceId, `No open country is open to ${railroadId}`)
    return spaceId
}

// R-3.3: the turn player places the railroad's piece on open country.
export function placeOnOpenCountry(
    game: Game,
    state: PromontoryPointGameState,
    railroadId: RailroadId
): Played {
    return play(game, state, PlaceTrack, {
        playerId: turnPlayer(state),
        railroadId,
        spaceId: openCountryFor(state, railroadId)
    })
}
