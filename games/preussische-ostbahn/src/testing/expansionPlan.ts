import { Ability, railroadDefinition, type RailroadId } from '../components/railroads.js'
import {
    FRESH_EXPANSION,
    canBuild,
    entryCost,
    isRural,
    tallyAfter,
    trackCharge
} from '../model/expansion.js'
import { findRailroad } from '../model/network.js'
import type { RailroadState } from '../model/railroadState.js'

export type ExpansionPlan = {
    costs: number[]
    total: number
    freeSpaceId?: string
}

export function planExpansion(
    railroads: readonly RailroadState[],
    railroadId: RailroadId,
    spaceIds: readonly string[]
): ExpansionPlan | undefined {
    if (spaceIds.length === 0) {
        return undefined
    }
    const working = railroads.map((railroad) => ({ ...railroad, track: [...railroad.track] }))
    const railroad = findRailroad(working, railroadId)
    let tally = FRESH_EXPANSION
    const costs: number[] = []
    const ruralCosts: [string, number][] = []
    for (const spaceId of spaceIds) {
        if (!canBuild(working, railroadId, spaceId, tally)) {
            return undefined
        }
        const charge = trackCharge(working, railroadId, spaceId, tally)
        if (isRural(spaceId)) {
            ruralCosts.push([spaceId, entryCost(working, railroadId, spaceId)])
        }
        tally = tallyAfter(working, railroadId, spaceId, tally)
        costs.push(charge)
        railroad.track.push(spaceId)
        railroad.treasury -= charge
    }
    const freeSpaceId =
        railroadDefinition(railroadId).ability === Ability.FreeRural && ruralCosts.length > 0
            ? ruralCosts.reduce((best, next) => (next[1] > best[1] ? next : best))[0]
            : undefined
    return { costs, total: tally.spent, ...(freeSpaceId !== undefined ? { freeSpaceId } : {}) }
}
