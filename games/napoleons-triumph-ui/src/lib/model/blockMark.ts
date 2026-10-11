import type { ProjectedUnit } from '@tabletop/napoleons-triumph'
import type { BattleRole } from './battleStage.js'
import { roleMarkOf, type RoleMark } from './roleMark.js'

export interface BlockMark {
    pickable: boolean
    role?: BattleRole
    roleMark?: RoleMark
    dimmed: boolean
    moved: boolean
}

export interface BlockMarkContext {
    viewerId?: string
    viewingHistory: boolean
    settling: boolean
    fighting: boolean
    pickableIds: readonly string[]
    roles: Readonly<Record<string, BattleRole>>
    selectedGroupKey?: string
    pickedUnitIds: readonly string[]
    ridingOn: boolean
}

function carriesMovedMark(unit: ProjectedUnit, context: BlockMarkContext): boolean {
    return (
        !context.fighting &&
        !context.viewingHistory &&
        unit.playerId === context.viewerId &&
        unit.movesThisTurn !== undefined
    )
}

export function blockMarkOf(
    unit: ProjectedUnit,
    groupKey: string,
    context: BlockMarkContext
): BlockMark {
    const eligible = context.pickableIds.includes(unit.id)
    const role = context.roles[unit.id]
    const leftOut =
        groupKey === context.selectedGroupKey && !context.pickedUnitIds.includes(unit.id)
    return {
        pickable: eligible && !context.settling,
        role,
        roleMark: role === undefined ? undefined : roleMarkOf(role),
        dimmed: leftOut || (context.fighting && !eligible && role === undefined),
        moved: carriesMovedMark(unit, context)
    }
}

export function shownMovedInUnitStrip(unit: ProjectedUnit, context: BlockMarkContext): boolean {
    return carriesMovedMark(unit, context) && !context.ridingOn
}
