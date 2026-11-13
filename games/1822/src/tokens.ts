import { addCompanyStations, type StationPosition } from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import { exchangeStationId, exchangeTokenCount1822 } from './companies.js'
import type { HydratedState1822 } from './state.js'

/** The exchange tokens left on a major company's charter (§5.6.3). */
export function exchangeTokens1822(state: HydratedState1822, companyId: string): number {
    return state.exchangeTokens.find((entry) => entry.companyId === companyId)?.count ?? 0
}

function takeExchangeToken(state: HydratedState1822, companyId: string): number {
    const count = exchangeTokens1822(state, companyId)
    assert(count > 0, 'The company has no exchange token left')
    state.exchangeTokens = [
        ...state.exchangeTokens.filter((entry) => entry.companyId !== companyId),
        ...(count > 1 ? [{ companyId, count: count - 1 }] : [])
    ]
    return exchangeTokenCount1822(companyId) - count + 1
}

/** Places one of the company's exchange tokens on the map (§5.12.4, §5.12.10). */
export function placeExchangeToken1822(
    state: HydratedState1822,
    companyId: string,
    position: StationPosition
): string {
    const id = exchangeStationId(companyId, takeExchangeToken(state, companyId))
    state.stations.push({ id, companyId, status: 'placed', position: { ...position } })
    return id
}

/** Moves one of the company's exchange tokens to its available tokens (§5.12.4, §5.12.7). */
export function releaseExchangeToken1822(state: HydratedState1822, companyId: string): void {
    takeExchangeToken(state, companyId)
    addCompanyStations(state, companyId, 1)
}

/** Puts an available token back among the company's exchange tokens (Table 3, P18). */
export function returnExchangeToken1822(state: HydratedState1822, stationId: string): void {
    const station = state.stations.find((entry) => entry.id === stationId)
    assert(station?.status === 'available', 'Only an available token returns to the charter')
    const { companyId } = station
    state.stations = state.stations.map((entry) =>
        entry.id === stationId ? { id: entry.id, companyId, status: 'removed' as const } : entry
    )
    state.exchangeTokens = [
        ...state.exchangeTokens.filter((entry) => entry.companyId !== companyId),
        { companyId, count: exchangeTokens1822(state, companyId) + 1 }
    ]
}

/** The lowest station space of a city not yet taken, which may be the space beside a full city. */
export function nextStationSlot(
    state: HydratedState1822,
    city: Omit<StationPosition, 'slot'>
): number {
    const taken = state.stations.flatMap((station) =>
        station.status === 'placed' &&
        station.position.locationId === city.locationId &&
        station.position.nodeId === city.nodeId
            ? [station.position.slot]
            : []
    )
    let slot = 0
    while (taken.includes(slot)) slot++
    return slot
}
