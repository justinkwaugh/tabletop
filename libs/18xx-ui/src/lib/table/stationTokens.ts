import { neutralStation, placeableStations, type StationState } from '@tabletop/18xx'

/**
 * A company's station tokens not yet on the map, its own and the neutral ones it holds, and the
 * same grouped by what placing each costs and whether it is neutral, as a narrow card shows them;
 * a group's count matters only where some group has several.
 */
export function remainingStationTokens(
    state: Pick<StationState, 'stations' | 'neutralStations'>,
    companyId: string,
    placementCost: (stationId: string) => number
) {
    const remaining = placeableStations(state, companyId).map((station) => ({
        ...station,
        neutral: !!neutralStation(state, station.id)
    }))
    const groups: { cost: number; neutral: boolean; count: number }[] = []
    for (const station of remaining) {
        const cost = placementCost(station.id)
        const group = groups.find(
            (entry) => entry.cost === cost && entry.neutral === station.neutral
        )
        if (group) group.count++
        else groups.push({ cost, neutral: station.neutral, count: 1 })
    }
    groups.sort((a, b) => Number(a.neutral) - Number(b.neutral) || a.cost - b.cost)
    return { remaining, groups, counted: groups.some((group) => group.count > 1) }
}
