import type { Face, ProjectedUnit } from '@tabletop/napoleons-triumph'
import { BattleRole } from './battleStage.js'
import { roleMarkOf, type RoleMark } from './roleMark.js'

/** How a unit is drawn for one viewer: the face they may see, the mark on their own unit that the enemy has seen, and the mark of the fixed battery. */
export interface UnitLook {
    face: Face | undefined
    seen: boolean
    fixed: boolean
}

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
    riderIds: readonly string[]
}

function carriesMovedMark(unit: ProjectedUnit, context: BlockMarkContext): boolean {
    return (
        !context.fighting &&
        !context.viewingHistory &&
        unit.playerId === context.viewerId &&
        unit.movesThisTurn !== undefined
    )
}

/**
 * Rule 11: a unit named in a defence is known to both players as a defender until its side's
 * opponent ends the turn. A unit that can be picked now is left bare, so the letter is never taken
 * for a pick already made.
 */
function carriesEarlierDefenceMark(
    unit: ProjectedUnit,
    eligible: boolean,
    role: BattleRole | undefined
): boolean {
    return unit.defendedApproach !== undefined && role === undefined && !eligible
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
    const defendedEarlier = carriesEarlierDefenceMark(unit, eligible, role)
    const lettered = defendedEarlier ? BattleRole.Defends : role
    return {
        pickable: eligible && !context.settling,
        role,
        roleMark: lettered === undefined ? undefined : roleMarkOf(lettered),
        dimmed: leftOut || (context.fighting && !eligible && role === undefined),
        moved: !defendedEarlier && carriesMovedMark(unit, context)
    }
}

export function shownMovedInUnitStrip(unit: ProjectedUnit, context: BlockMarkContext): boolean {
    return carriesMovedMark(unit, context) && !context.riderIds.includes(unit.id)
}
