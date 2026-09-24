import * as Type from 'typebox'
import * as Value from 'typebox/value'
import { ActionSource, type GameAction } from './gameAction.js'
import { isSupersedableActionType } from './actionHistory.js'
import type { GameEngine } from './gameEngine.js'
import type { Game } from '../model/game.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'

export type SupersedeReplay<T extends GameState> = {
    undone: GameAction[]
    redone: GameAction[]
    state: T
}

export type SupersedeOutcome<T extends GameState> =
    | { kind: 'invalid'; reason: string }
    | ({ kind: 'replace' } & SupersedeReplay<T>)

const VolatileKeys = ['id', 'index', 'undoPatch', 'forwardPatch', 'createdAt', 'updatedAt'] as const

function stable(action: GameAction): Record<string, unknown> {
    const copy: Record<string, unknown> = { ...action }
    for (const key of VolatileKeys) delete copy[key]
    return copy
}

function sameRun(recorded: readonly GameAction[], regenerated: readonly GameAction[]): boolean {
    return (
        recorded.length === regenerated.length &&
        recorded.every((action, index) => {
            const other = regenerated[index]
            return (
                action.source === other.source &&
                (action.source === ActionSource.System || action.id === other.id) &&
                Value.Equal(stable(action), stable(other))
            )
        })
    )
}

function runs(actions: readonly GameAction[]): GameAction[][] {
    const result: GameAction[][] = []
    for (const action of actions) {
        if (action.source === ActionSource.User || result.length === 0) result.push([action])
        else result[result.length - 1].push(action)
    }
    return result
}

function unprocessed(action: GameAction): GameAction {
    const copy = structuredClone(action)
    delete copy.index
    delete copy.undoPatch
    delete copy.forwardPatch
    return copy
}

export function replaceSupersededAction<
    T extends GameState,
    U extends HydratedGameState<T> = HydratedGameState<T>
>({
    engine,
    apiActions,
    game,
    state,
    window,
    replacement
}: {
    engine: GameEngine<T, U>
    apiActions: Readonly<Record<string, Type.TSchema>>
    game: Game
    state: T
    window: readonly GameAction[]
    replacement: GameAction
}): SupersedeOutcome<T> {
    const target = window[0]
    if (!target || target.id !== replacement.supersedesActionId)
        return { kind: 'invalid', reason: 'the Action it replaces is not in Action History' }
    if (!isSupersedableActionType(apiActions, replacement.type))
        return { kind: 'invalid', reason: `Actions of type ${replacement.type} cannot supersede` }
    if (
        target.source !== ActionSource.User ||
        target.playerId !== replacement.playerId ||
        target.type !== replacement.type
    )
        return {
            kind: 'invalid',
            reason: 'it may only replace its own earlier Action of the same type'
        }
    if (window.some((action) => action.undoPatch === undefined))
        return { kind: 'invalid', reason: 'the history since it cannot be reversed' }
    try {
        let current = state
        for (const action of window.toReversed())
            current = engine.undoProcessedAction({ action, state: current })
        const redone: GameAction[] = []
        for (const run of runs(window.slice(1))) {
            if (run[0].source !== ActionSource.User)
                return { kind: 'invalid', reason: 'a later automatic consequence depended on it' }
            const result = engine.executeCanonicalAction({
                action: unprocessed(run[0]),
                state: current,
                game
            })
            if (!sameRun(run, result.processedActions))
                return { kind: 'invalid', reason: 'a later Action depended on it' }
            redone.push(...result.processedActions)
            current = result.updatedState
        }
        engine.executeCanonicalAction({ action: unprocessed(replacement), state: current, game })
        return { kind: 'replace', undone: [...window], redone, state: current }
    } catch (error) {
        return { kind: 'invalid', reason: error instanceof Error ? error.message : String(error) }
    }
}
