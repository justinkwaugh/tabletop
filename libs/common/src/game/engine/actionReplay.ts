import * as Value from 'typebox/value'
import { ActionSource, type GameAction, withoutActionPatches } from './gameAction.js'
import { isCascadedSystemAction } from './actionHistory.js'

const VolatileKeys = ['id', 'index', 'undoPatch', 'forwardPatch', 'createdAt', 'updatedAt'] as const

function stable(action: GameAction): Record<string, unknown> {
    const copy: Record<string, unknown> = { ...action }
    for (const key of VolatileKeys) delete copy[key]
    return copy
}

export function sameRun(
    recorded: readonly GameAction[],
    regenerated: readonly GameAction[]
): boolean {
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

export function runs(actions: readonly GameAction[]): GameAction[][] {
    const result: GameAction[][] = []
    for (const action of actions) {
        if (!isCascadedSystemAction(action) || result.length === 0) result.push([action])
        else result[result.length - 1].push(action)
    }
    return result
}

export function unprocessed(action: GameAction): GameAction {
    const copy = withoutActionPatches(action)
    delete copy.index
    return copy
}
