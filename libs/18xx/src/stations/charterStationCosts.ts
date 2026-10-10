import { assertExists } from '@tabletop/common'
import type { StationState } from '../map/station.js'

export type CharterStationCosts = Readonly<Record<string, readonly number[]>>

/** The price of a company's next station: the charter cost after the stations it has used. */
export function charterStationCost(
    state: Pick<StationState, 'stations'>,
    stationId: string,
    costs: CharterStationCosts
): number {
    const station = state.stations.find((station) => station.id === stationId)
    assertExists(station, 'A station placement requires a known station')
    const used = state.stations.filter(
        (entry) => entry.companyId === station.companyId && entry.status !== 'available'
    ).length
    const cost = costs[station.companyId]?.[used]
    assertExists(cost, `The ${station.companyId} charter prices every station`)
    return cost
}

/** How many stations each charter provides. */
export function charterStationCounts(costs: CharterStationCosts): Readonly<Record<string, number>> {
    return Object.fromEntries(
        Object.entries(costs).map(([companyId, schedule]) => [companyId, schedule.length])
    )
}
