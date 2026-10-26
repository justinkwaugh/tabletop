import { assertExists, type Game, type GameEngine, type GameState } from '@tabletop/common'

/** A player's valid actions worked out in their own view, as their browser does, and in the full game. */
export function ownViewActions<State extends GameState>(
    engine: GameEngine<State>,
    game: Game,
    state: State,
    playerId: string
): { own: string[]; full: string[] } {
    const visibility = engine.runtime.visibility
    assertExists(visibility, 'Only a title with hidden information has a player view')
    const perspective = { kind: 'player', playerId } as const
    const view = visibility.state.project(state, perspective)
    return {
        own: engine.getValidActionTypesForPlayer(game, view, playerId, { perspective }),
        full: engine.getValidActionTypesForPlayer(game, state, playerId)
    }
}
