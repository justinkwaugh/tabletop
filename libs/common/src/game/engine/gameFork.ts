import { nanoid } from 'nanoid'
import { assert, assertExists } from '../../util/assertions.js'
import { calculateActionChecksum } from '../../util/checksum.js'
import { BaseError } from '../../util/errors.js'
import type { GameRuntime } from '../definition/gameDefinition.js'
import { GameStatus, type Game } from '../model/game.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'
import { ActionSource, type GameAction, type Patch } from './gameAction.js'
import { GameEngine } from './gameEngine.js'

export class GameForkError extends BaseError {
    constructor(gameId: string, actionIndex: number) {
        super({
            name: 'GameForkError',
            message: 'This game cannot be forked from that position.',
            metadata: { gameId, actionIndex }
        })
    }
}

export function createGameFork<T extends GameState, U extends HydratedGameState<T>>({
    game,
    state: currentState,
    actions,
    actionIndex,
    runtime,
    name
}: {
    game: Game
    state: T
    actions: readonly GameAction[]
    actionIndex: number
    runtime: GameRuntime<T, U>
    name?: string
}): { game: Game; state: T; actions: GameAction[] } {
    try {
        assert(
            Number.isInteger(actionIndex) && actionIndex >= -1 && actionIndex < actions.length,
            'Invalid fork position'
        )
        assert(
            currentState.gameId === game.id && currentState.actionCount === actions.length,
            'Fork source state and history disagree'
        )
        const ordered = actions.toSorted((a, b) => (a.index ?? -1) - (b.index ?? -1))
        assert(
            ordered.every((action, index) => action.index === index && action.gameId === game.id),
            'Invalid fork source history'
        )
        assert(
            calculateActionChecksum(0, ordered) === currentState.actionChecksum,
            'Fork source checksum mismatch'
        )

        let end = actionIndex + 1
        if (end > 0) {
            while (end < ordered.length && ordered[end].source === ActionSource.System) end += 1
        }
        const engine = new GameEngine(runtime)
        let state = structuredClone(currentState)
        for (const action of ordered.slice(end).toReversed()) {
            state = engine.undoProcessedAction({ action, state })
        }
        const inherited = ordered.slice(0, end)
        assert(
            state.actionCount === end &&
                state.actionChecksum === calculateActionChecksum(0, inherited),
            'Fork position could not be reconstructed'
        )
        runtime.hydrator.hydrateState(state)
        assertExists(
            runtime.stateHandlers[state.machineState],
            'Fork position has no state handler'
        )

        const fork = structuredClone(game)
        fork.id = nanoid()
        fork.parentId = game.id
        fork.name = name?.trim() || game.name
        fork.createdAt = new Date()
        fork.updatedAt = fork.createdAt
        fork.startedAt = fork.createdAt
        fork.status = GameStatus.Started
        delete fork.state
        delete fork.finishedAt
        delete fork.result
        fork.winningPlayerIds = []
        fork.activePlayerIds = [...state.activePlayerIds]
        fork.lastActionAt = inherited.at(-1)?.createdAt
        fork.lastActionPlayerId = inherited.at(-1)?.playerId
        state.gameId = fork.id

        return {
            game: fork,
            state,
            actions: inherited.map((original) => ({
                ...structuredClone(original),
                gameId: fork.id,
                undoPatch: forkPatch(original.undoPatch, fork.id),
                forwardPatch: forkPatch(original.forwardPatch, fork.id)
            }))
        }
    } catch {
        throw new GameForkError(game.id, actionIndex)
    }
}

function forkPatch(patch: Patch | undefined, gameId: string): Patch | undefined {
    return patch === undefined
        ? undefined
        : [...structuredClone(patch), { op: 'add', path: '/gameId', value: gameId }]
}
