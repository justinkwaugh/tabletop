import { assert } from '@tabletop/common'
import type { RoadArrival } from '../components/battleMap.js'
import { UnitType } from '../components/pieces.js'
import { CommandKind, type Attack, type MoveOrder } from './attack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { allCavalry, traceRoadMove } from './movement.js'
import { canStillMove, commanderCanCommand, independentCommandsLeft, resolveOrder, type ResolvedOrder } from './orders.js'
import { faceOf, inReserve, samePosition, type Position, type ProjectedUnit } from './pieces.js'

export interface AttackOrders {
    resolved: ResolvedOrder[]
    units: ProjectedUnit[]
    /** Where the attackers stand in the attack locale: its reserve, or blocking the attack approach. */
    stance: Position
    /** Set when the attackers reach the attack locale by road (cavalry only). */
    road?: { path: number[]; arrivals: RoadArrival[] }
    /** Two artillery Unit Moves combined; allowed only when both batteries lead the attack (erratum to rule 11). */
    artilleryPair: boolean
}

/**
 * Checks the command or commands named in an attack declaration (rule 11): who attacks, from
 * where, and whether several commands may be combined.
 */
export function resolveAttackOrders(
    state: HydratedNapoleonsTriumphGameState,
    attack: Pick<Attack, 'attackerId' | 'attackApproach'>,
    orders: readonly MoveOrder[]
): AttackOrders {
    assert(orders.length > 0, 'An attack needs a command')
    const approach = state.map.approach(attack.attackApproach)
    const resolved = orders.map((order) => resolveOrder(state, attack.attackerId, order))
    const units = resolved.flatMap((entry) => entry.units)
    assert(new Set(units.map((unit) => unit.id)).size === units.length, 'A unit attacks once')
    const blocking: Position = { locale: approach.locale, approach: approach.id }
    const reserve: Position = { locale: approach.locale }

    const [first] = resolved
    if (first.order.road !== undefined) {
        assert(resolved.length === 1, 'A road attack is made by a single command')
        assert(allCavalry(units), 'Only cavalry can attack by road')
        const path = first.order.road
        assert(path[path.length - 1] === approach.locale, 'The road must lead to the attack locale')
        const arrivals = traceRoadMove(state, first, path).filter((arrival) =>
            state.map
                .roadLinksAcross(approach.id)
                .some((link) => link.fromGroup === arrival.group)
        )
        assert(arrivals.length > 0, 'The road does not cross the attack approach')
        return { resolved, units, stance: reserve, road: { path, arrivals }, artilleryPair: false }
    }

    const stance = first.start
    assert(
        samePosition(stance, blocking) || samePosition(stance, reserve),
        'Attackers must be in the attack locale, in reserve or blocking the attack approach'
    )
    assert(
        resolved.every((entry) => samePosition(entry.start, stance)),
        'Combined commands must start in the same position'
    )
    if (resolved.length > 1) {
        const allCorps = resolved.every((entry) => entry.order.kind === CommandKind.Corps)
        const artilleryPair =
            resolved.length === 2 &&
            samePosition(stance, blocking) &&
            resolved.every(
                (entry) =>
                    entry.order.kind === CommandKind.Unit &&
                    faceOf(entry.units[0]).type === UnitType.Artillery
            )
        assert(
            allCorps || artilleryPair,
            'Only Corps Moves, or two artillery Unit Moves on the attack approach, can be combined'
        )
        const commanders = new Set(resolved.map((entry) => entry.order.commanderId))
        assert(!allCorps || commanders.size === resolved.length, 'A commander gives one command')
        const independent = resolved.filter((entry) => entry.order.kind === CommandKind.Unit)
        assert(
            independent.length <= independentCommandsLeft(state, attack.attackerId),
            'Not enough independent commands are left'
        )
    }
    assert(stance !== undefined, 'Attackers must be on the map')
    const artilleryPair =
        resolved.length === 2 && resolved.every((entry) => entry.order.kind === CommandKind.Unit)
    return { resolved, units, stance, artilleryPair }
}

/** Whether any command at all could attack across an approach; an attack threat must be real. */
export function canThreaten(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    attackApproach: number
): boolean {
    const approach = state.map.approach(attackApproach)
    const candidates = [
        ...state.reserveUnits(approach.locale, playerId),
        ...state.blockers(approach.id, playerId)
    ]
    return (
        candidates.some((unit) => hasUsableCommand(state, unit)) ||
        cavalryCanArriveByRoad(state, playerId, attackApproach)
    )
}

/** Whether some command could still move this unit this turn. */
export function hasUsableCommand(
    state: HydratedNapoleonsTriumphGameState,
    unit: ProjectedUnit
): boolean {
    if (!canStillMove(state, unit)) {
        return false
    }
    const inCorps = unit.commanderId !== undefined
    const byCommander =
        unit.commanderId !== undefined &&
        commanderCanCommand(state, state.commander(unit.commanderId))
    const independently =
        independentCommandsLeft(state, unit.playerId) > 0 &&
        (!inCorps || state.corpsUnits(unit.commanderId ?? '').length > 1)
    return byCommander || independently
}

function cavalryCanArriveByRoad(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    attackApproach: number
): boolean {
    const approach = state.map.approach(attackApproach)
    const groups = new Set(
        state.map.roadLinksAcross(approach.id).map((link) => link.fromGroup)
    )
    if (groups.size === 0) {
        return false
    }
    const cavalry = state
        .unitsOf(playerId)
        .filter(
            (unit) =>
                unit.position !== undefined &&
                inReserve(unit.position) &&
                unit.position.locale !== approach.locale &&
                hasUsableCommand(state, unit) &&
                faceOf(unit).type === UnitType.Cavalry
        )
    return cavalry.some((unit) => {
        const start = unit.position
        if (start === undefined) {
            return false
        }
        return roadPathsTo(state, start.locale, approach.locale).some((path) =>
            state.map
                .traceRoad(start.locale, path)
                .some((arrival) => groups.has(arrival.group))
        )
    })
}

/** Road paths of up to three locales from one locale to another, ignoring who holds them. */
function roadPathsTo(
    state: HydratedNapoleonsTriumphGameState,
    from: number,
    to: number
): number[][] {
    const paths: number[][] = []
    const extend = (path: number[], locale: number) => {
        if (path.length >= 3) {
            return
        }
        for (const next of new Set(state.map.roadLinksFrom(locale).map((link) => link.to))) {
            const longer = [...path, next]
            if (next === to) {
                paths.push(longer)
            } else {
                extend(longer, next)
            }
        }
    }
    extend([], from)
    return paths
}
