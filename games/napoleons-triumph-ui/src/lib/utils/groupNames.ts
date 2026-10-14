import {
    commanderDefinition,
    type BattleMap,
    type ProjectedUnit
} from '@tabletop/napoleons-triumph'
import { standingAt } from './standing.js'

export function corpsName(commanderId: string): string {
    return `${commanderDefinition(commanderId).name}’s corps`
}

/** The corps a unit on the map stands in, or that it is detached and how it stands. */
export function standingGroupName(map: BattleMap, unit: ProjectedUnit): string {
    if (unit.commanderId !== undefined) {
        return corpsName(unit.commanderId)
    }
    return unit.position ? `Detached, ${standingAt(map, unit.position).stance}` : 'Detached'
}
