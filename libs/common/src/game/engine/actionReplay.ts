import * as Value from 'typebox/value'
import { ActionSource, type GameAction } from './gameAction.js'

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
        if (action.source === ActionSource.User || result.length === 0) result.push([action])
        else result[result.length - 1].push(action)
    }
    return result
}

export function unprocessed(action: GameAction): GameAction {
    const copy = structuredClone(action)
    delete copy.index
    delete copy.undoPatch
    delete copy.forwardPatch
    return copy
}
