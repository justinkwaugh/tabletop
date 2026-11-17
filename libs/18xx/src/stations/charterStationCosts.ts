import { assert, assertExists } from '@tabletop/common'
import type { Station, StationState } from '../map/station.js'
import type { StationPlacementContext } from './stationPlacement.js'

export type CharterStationCosts = Readonly<Record<string, readonly number[]>>

/**
 * A station's price from its charter's printed costs. A placement pays the next price, after the
 * charter stations already used, whichever token is placed; an unplaced token shown on the charter
 * keeps the price printed for its place among those still waiting.
 */
export function charterScheduleCost(
    charter: readonly Station[],
    stationId: string,
    schedule: readonly number[],
    placement?: StationPlacementContext
): number {
    const used = charter.filter((station) => station.status !== 'available').length
    const waitingIndex = placement
        ? 0
        : charter
              .filter((station) => station.status === 'available')
              .findIndex((station) => station.id === stationId)
    assert(waitingIndex >= 0, 'A charter price is shown for a waiting charter token')
    const cost = schedule[used + waitingIndex]
    assertExists(cost, 'The charter prices each of its stations')
    return cost
}

/** A company's station priced by its charter's printed costs. */
export function charterStationCost(
    state: Pick<StationState, 'stations'>,
    stationId: string,
    costs: CharterStationCosts,
    placement?: StationPlacementContext
): number {
    const station = state.stations.find((station) => station.id === stationId)
    assertExists(station, 'A station placement requires a known station')
    const schedule = costs[station.companyId]
    assertExists(schedule, `The ${station.companyId} charter prices every station`)
    return charterScheduleCost(
        state.stations.filter((entry) => entry.companyId === station.companyId),
        stationId,
        schedule,
        placement
    )
}

/** How many stations each charter provides. */
export function charterStationCounts(costs: CharterStationCosts): Readonly<Record<string, number>> {
    return Object.fromEntries(
        Object.entries(costs).map(([companyId, schedule]) => [companyId, schedule.length])
    )
}
