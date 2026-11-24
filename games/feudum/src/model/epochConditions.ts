import { RegionIds } from '../data/regionTiles.js'
import type { Sunray } from '../data/tracks.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { stackTop } from './regionStacks.js'
import { nextSunray } from './tracks.js'

/** R-4.11.2 How many stack tops show what this sunray asks for, and how many it asks for. */
export interface EpochConditionShown {
    readonly showing: number
    readonly count: number
}

/** R-4.11.2, R-1.2.5 An empty stack shows V. Undefined: this sunray asks for nothing. */
export function epochConditionShown(
    state: HydratedFeudumGameState,
    { advanceWhen: condition }: Sunray
): EpochConditionShown | undefined {
    if (condition.kind === 'start') {
        return undefined
    }
    const tops = RegionIds.map((region) => stackTop(state, region))
    const showing =
        condition.kind === 'empty-stacks'
            ? tops.filter((top) => top === undefined)
            : tops.filter((top) => top?.epoch === condition.tileEpoch)
    return { showing: showing.length, count: condition.count }
}

/** R-4.11.2 Whether the stack tops show what this sunray asks for. */
export function epochConditionMet(state: HydratedFeudumGameState, ray: Sunray): boolean {
    const shown = epochConditionShown(state, ray)
    return shown !== undefined && shown.showing >= shown.count
}

/** R-4.11.2 The next sunray if its condition is met: epochs advance one at a time. */
export function triggeredEpoch(state: HydratedFeudumGameState): Sunray | undefined {
    const next = nextSunray(state.epoch)
    return next !== undefined && epochConditionMet(state, next) ? next : undefined
}
