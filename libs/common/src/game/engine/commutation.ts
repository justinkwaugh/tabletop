import * as Type from 'typebox'
import * as Value from 'typebox/value'
import { ActionSource, type GameAction } from './gameAction.js'
import { runs, sameRun, unprocessed } from './actionReplay.js'
import { isSequencedActionType } from './actionHistory.js'
import type { GameEngine } from './gameEngine.js'
import type { Game } from '../model/game.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'

export type CommutationOutcome = { kind: 'commutes' } | { kind: 'invalid'; reason: string }

export function racesSequencedAction(
    apiActions: Readonly<Record<string, Type.TSchema>>,
    late: GameAction,
    raced: readonly GameAction[]
): boolean {
    return [late, ...raced].some(
        (action) =>
            action.source === ActionSource.User && isSequencedActionType(apiActions, action.type)
    )
}

function withoutActionPositions(state: GameState): Record<string, unknown> {
    const { actionCount: _count, actionChecksum: _checksum, turnManager, ...rest } = state
    return {
        ...rest,
        turnManager: {
            ...turnManager,
            series: turnManager.series.map(({ start: _start, end: _end, ...turn }) => turn)
        }
    }
}

export function proveCommutation<
    T extends GameState,
    U extends HydratedGameState<T> = HydratedGameState<T>
>({
    engine,
    apiActions,
    game,
    state,
    raced,
    late
}: {
    engine: GameEngine<T, U>
    apiActions: Readonly<Record<string, Type.TSchema>>
    game: Game
    state: T
    raced: readonly GameAction[]
    late: GameAction
}): CommutationOutcome {
    const invalid = (reason: string): CommutationOutcome => ({ kind: 'invalid', reason })
    if (!racesSequencedAction(apiActions, late, raced))
        return invalid('no sequenced out-of-turn Action is involved')
    if (raced.some((action) => action.undoPatch === undefined))
        return invalid('the raced Actions cannot be reversed')
    if ([late, ...raced].some((action) => action.revealsInfo))
        return invalid('an involved Action reveals information')
    const racedRuns = runs(raced)
    if (racedRuns.some((run) => run[0].source !== ActionSource.User))
        return invalid('a raced automatic consequence has no Action to replay')
    if (racedRuns.some((run) => run[0].playerId === late.playerId))
        return invalid('the Player already acted since that position')
    try {
        const afterRaced = engine.executeCanonicalAction({
            action: unprocessed(late),
            state,
            game
        })
        if (afterRaced.processedActions.some((action) => action.revealsInfo))
            return invalid('an involved Action reveals information')
        let current = state
        for (const action of raced.toReversed())
            current = engine.undoProcessedAction({ action, state: current })
        const lateFirst = engine.executeCanonicalAction({
            action: unprocessed(late),
            state: current,
            game
        })
        if (!sameRun(afterRaced.processedActions, lateFirst.processedActions))
            return invalid('its consequences depend on the order')
        current = lateFirst.updatedState
        for (const run of racedRuns) {
            const result = engine.executeCanonicalAction({
                action: unprocessed(run[0]),
                state: current,
                game
            })
            if (!sameRun(run, result.processedActions))
                return invalid('a raced Action’s consequences depend on the order')
            current = result.updatedState
        }
        if (
            !Value.Equal(
                withoutActionPositions(afterRaced.updatedState),
                withoutActionPositions(current)
            )
        )
            return invalid('the orders reach different Game States')
        return { kind: 'commutes' }
    } catch (error) {
        return invalid(error instanceof Error ? error.message : String(error))
    }
}
