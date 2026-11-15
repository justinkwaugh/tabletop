import type { Station } from '@tabletop/18xx'

/**
 * A company's station tokens not yet on the map, and the same grouped by what placing each
 * costs, as a narrow card shows them; a group's count matters only where some cost has several.
 */
export function remainingStationTokens(
    stations: readonly Station[],
    companyId: string,
    placementCost: (stationId: string) => number
) {
    const remaining = stations.filter(
        (station) => station.companyId === companyId && station.status === 'available'
    )
    const counts = new Map<number, number>()
    for (const station of remaining) {
        const cost = placementCost(station.id)
        counts.set(cost, (counts.get(cost) ?? 0) + 1)
    }
    const groups = [...counts].sort(([a], [b]) => a - b).map(([cost, count]) => ({ cost, count }))
    return { remaining, groups, counted: groups.some((group) => group.count > 1) }
}
