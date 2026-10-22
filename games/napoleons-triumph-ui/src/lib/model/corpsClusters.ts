import type { ProjectedUnit } from '@tabletop/napoleons-triumph'

/** Units of one corps, or the detached units (no commander), as a battle panel lists them. */
export interface CorpsCluster {
    commanderId?: string
    units: ProjectedUnit[]
}

/**
 * The units by corps, in the order the map stacks its groups: corps by commander, detached units
 * last. Within each, `asRead` orders the units, so the enemy's are never put in an order that tells something.
 */
export function corpsClusters(
    units: readonly ProjectedUnit[],
    asRead: (units: readonly ProjectedUnit[]) => ProjectedUnit[]
): CorpsCluster[] {
    const byCommander = new Map<string | undefined, ProjectedUnit[]>()
    for (const unit of units) {
        byCommander.set(unit.commanderId, [...(byCommander.get(unit.commanderId) ?? []), unit])
    }
    return [...byCommander.keys()]
        .toSorted((a, b) => {
            if ((a === undefined) !== (b === undefined)) {
                return a === undefined ? 1 : -1
            }
            return (a ?? '').localeCompare(b ?? '')
        })
        .map((commanderId) => ({ commanderId, units: asRead(byCommander.get(commanderId) ?? []) }))
}
