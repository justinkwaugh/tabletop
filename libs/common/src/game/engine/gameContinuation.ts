import { nanoid } from 'nanoid'
import { BaseError } from '../../util/errors.js'
import type { GameDefinition } from '../definition/gameDefinition.js'
import { GameStatus, type Game } from '../model/game.js'
import type { GameState } from '../model/gameState.js'
import { validateGameResult } from '../model/gameResult.js'
import { GameEngine } from './gameEngine.js'
import { getGameVisibility } from '../visibility/gameVisibility.js'

export class GameContinuationError extends BaseError {
    constructor(message: string) {
        super({ name: 'GameContinuationError', message })
    }
}

export function assertContinuationAllowed(condition: unknown, message: string): asserts condition {
    if (!condition) throw new GameContinuationError(message)
}

export function initializeContinuationGame(
    source: Game,
    state: GameState,
    definition: GameDefinition
): Game {
    assertContinuationAllowed(
        source.typeId === definition.info.id,
        'Continuation must use the same Game Title'
    )
    assertContinuationAllowed(!source.tournament, 'Tournament games cannot be continued')
    assertContinuationAllowed(
        !source.deleted && source.status === GameStatus.Finished,
        'Only finished games can be continued'
    )
    assertContinuationAllowed(
        definition.runtime.initializer.supportsContinuation === true,
        'This initializer does not support continuation'
    )
    getGameVisibility(source, definition.runtime)
    const canonical = definition.runtime.hydrator.hydrateState(structuredClone(state)).dehydrate()
    new GameEngine(definition.runtime).validateCanonicalState(canonical)
    validateGameResult(canonical)
    assertContinuationAllowed(
        canonical.gameId === source.id && canonical.canContinue === true,
        'Game is not ready to continue'
    )
    const game = definition.runtime.initializer.initializeGame(
        {
            id: nanoid(),
            typeId: source.typeId,
            ownerId: source.ownerId,
            name: source.name,
            players: structuredClone(source.players),
            config: structuredClone(source.config),
            isPublic: source.isPublic,
            hotseat: source.hotseat,
            storage: source.storage
        },
        definition
    )
    game.continuedFromGameId = source.id
    return game
}
