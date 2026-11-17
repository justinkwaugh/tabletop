import { assertExists } from '@tabletop/common'
import { waitingStationIndex, type Station } from '../map/station.js'
import type { StationPlacementContext, StationRules } from './stationPlacement.js'

export type CharterStationCosts = Readonly<Record<string, readonly number[]>>

/**
 * A charter station's printed price. Any waiting token may be placed, and a placement pays the
 * next price; a token shown without a placement keeps the price printed for its own place.
 */
export function charterScheduleCost(
    charter: readonly Station[],
    stationId: string,
    schedule: readonly number[],
    context?: StationPlacementContext
): number {
    const station = charter.find((entry) => entry.id === stationId)
    assertExists(station, `Station ${stationId} is on its charter`)
    const used = charter.filter((entry) => entry.status !== 'available').length
    const cost = schedule[used + (context ? 0 : waitingStationIndex(charter, station))]
    assertExists(cost, 'The charter prices each of its stations')
    return cost
}

/** Stations priced by each company's charter, in the order they are placed. */
export function charterStationCost(costs: CharterStationCosts): StationRules['placementCost'] {
    return (state, stationId, context) => {
        const station = state.stations.find((entry) => entry.id === stationId)
        assertExists(station, `Station ${stationId} exists`)
        const schedule = costs[station.companyId]
        assertExists(schedule, `The ${station.companyId} charter prices every station`)
        return charterScheduleCost(
            state.stations.filter((entry) => entry.companyId === station.companyId),
            stationId,
            schedule,
            context
        )
    }
}

/** How many stations each charter provides. */
export function charterStationCounts(costs: CharterStationCosts): Readonly<Record<string, number>> {
    return Object.fromEntries(
        Object.entries(costs).map(([companyId, schedule]) => [companyId, schedule.length])
    )
}
