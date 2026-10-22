import type { ProjectedUnit } from '@tabletop/napoleons-triumph'
import { byCommander } from '$lib/utils/groupOrder.js'

export interface CorpsCluster {
    commanderId?: string
    units: ProjectedUnit[]
}

/** In the order the map stacks the groups; `asRead` orders the units within, so the enemy's tell nothing by their order. */
export function corpsClusters(
    units: readonly ProjectedUnit[],
    asRead: (units: readonly ProjectedUnit[]) => ProjectedUnit[]
): CorpsCluster[] {
    const unitsByCommander = new Map<string | undefined, ProjectedUnit[]>()
    for (const unit of units) {
        const corps = unitsByCommander.get(unit.commanderId) ?? []
        unitsByCommander.set(unit.commanderId, [...corps, unit])
    }
    return [...unitsByCommander.keys()].toSorted(byCommander).map((commanderId) => ({
        commanderId,
        units: asRead(unitsByCommander.get(commanderId) ?? [])
    }))
}
