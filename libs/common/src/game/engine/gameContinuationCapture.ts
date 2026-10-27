import type { GameDefinition } from '../definition/gameDefinition.js'
import { GameCategory, type Game } from '../model/game.js'
import type { GameState } from '../model/gameState.js'
import { assertContinuationAllowed, type GameContinuation } from './gameContinuation.js'
import { GameEngine } from './gameEngine.js'

export function captureGameContinuation(
    source: Game,
    state: GameState,
    definition: GameDefinition
): GameContinuation {
    assertContinuationAllowed(
        source.typeId === definition.info.id,
        'Continuation must use the same Game Title'
    )
    assertContinuationAllowed(
        !source.deleted && source.category !== GameCategory.Exploration,
        'Explorations and deleted games cannot be continued'
    )
    return new GameEngine(definition.runtime).validateContinuation(source.id, {
        previousState: state,
        previousPlayers: source.players
    })
}

export async function linkGameContinuation(
    game: Game,
    sourceGameId: string | undefined,
    definition: GameDefinition,
    loadSource: (sourceGameId: string) => Promise<Game | undefined>
): Promise<GameContinuation | undefined> {
    if (sourceGameId === undefined) return undefined
    const source = await loadSource(sourceGameId)
    assertContinuationAllowed(source?.state, 'The game being continued was not found')
    const continuation = captureGameContinuation(source, source.state, definition)
    game.continuedFromGameId = source.id
    return continuation
}
