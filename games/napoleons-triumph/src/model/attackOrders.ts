import { assert } from '@tabletop/common'
import { UnitType } from '../components/pieces.js'
import { CommandKind, type Attack, type MoveOrder } from './attack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { allCavalry, roadOrigin, traceRoadMove } from './movement.js'
import { isLegal } from './legality.js'
import {
    assertArrived,
    canBeCommanded,
    commanderCanCommand,
    corpsCommandsLeft,
    independentCommandsLeft,
    resolveOrder,
    type ResolvedOrder
} from './orders.js'
import { faceOf, inReserve, samePosition, type Position, type ProjectedUnit } from './pieces.js'

export interface AttackOrders {
    resolved: ResolvedOrder[]
    units: ProjectedUnit[]
    stance: Position
    byRoad: boolean
    /** Two artillery Unit Moves combined; allowed only when both batteries lead the attack (erratum to rule 11). */
    artilleryPair: boolean
}

/**
 * An attack by road (rule 11): one command, cavalry only, riding from reserve along a road that
 * goes on across the attack approach, with enough road movement left to enter the defense locale.
 */
function resolveRoadAttack(
    state: HydratedNapoleonsTriumphGameState,
    attack: Pick<Attack, 'attackerId' | 'attackApproach'>,
    resolved: ResolvedOrder[]
): AttackOrders {
    const [first] = resolved
    const approach = state.map.approach(attack.attackApproach)
    const reserve: Position = { locale: approach.locale }
    const path = first.order.road ?? []
    assert(resolved.length === 1, 'A road attack is made by a single command')
    assert(allCavalry(first.units), 'Only cavalry can attack by road')
    if (path.length === 0) {
        assert(samePosition(first.start, reserve), 'A road attack starts in reserve')
    } else {
        assert(path[path.length - 1] === approach.locale, 'The road must lead to the attack locale')
    }
    if (first.start === undefined) {
        assertArrived(state, first)
    }
    traceRoadMove(state, first, path, true)
    const whole = [...(first.march?.path ?? []), ...path, approach.neighbour]
    assert(
        state.map.traceRoad(roadOrigin(first), whole).length > 0,
        'The road does not carry the cavalry across that approach'
    )
    return { resolved, units: first.units, stance: reserve, byRoad: true, artilleryPair: false }
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
    if (resolved.some((entry) => entry.order.road !== undefined)) {
        return resolveRoadAttack(state, attack, resolved)
    }
    assert(
        resolved.every((entry) => entry.march === undefined),
        'Cavalry riding on by road attacks by road'
    )

    const stance = first.start
    assert(
        samePosition(stance, blocking) || samePosition(stance, reserve),
        'Attackers must be in the attack locale, in reserve or blocking the attack approach'
    )
    assert(
        resolved.every((entry) => samePosition(entry.start, stance)),
        'Combined commands must start in the same position'
    )
    const artilleryPair =
        resolved.length === 2 &&
        samePosition(stance, blocking) &&
        resolved.every(
            (entry) =>
                entry.order.kind === CommandKind.Unit &&
                faceOf(entry.units[0]).type === UnitType.Artillery
        )
    if (resolved.length > 1) {
        const allCorps = resolved.every((entry) => entry.order.kind === CommandKind.Corps)
        assert(
            allCorps || artilleryPair,
            'Only Corps Moves, or two artillery Unit Moves on the attack approach, can be combined'
        )
        const commanders = new Set(resolved.map((entry) => entry.order.commanderId))
        assert(!allCorps || commanders.size === resolved.length, 'A commander gives one command')
        // Rule 11: each command in a combined move counts separately against the command limits.
        const independent = resolved.filter((entry) => entry.order.kind === CommandKind.Unit)
        assert(
            independent.length <= independentCommandsLeft(state, attack.attackerId),
            'Not enough independent commands are left'
        )
        assert(
            resolved.length - independent.length <= corpsCommandsLeft(state, attack.attackerId),
            'Not enough corps commands are left'
        )
    }
    assert(stance !== undefined, 'Attackers must be on the map')
    return { resolved, units, stance, byRoad: false, artilleryPair }
}

/**
 * Artillery may not lead attacks from the same attack approach in consecutive rounds unless it
 * fires down from a hill, nor twice across it in one turn (rule 11, step 5).
 */
export function artilleryMayFire(
    state: HydratedNapoleonsTriumphGameState,
    attackApproach: number
): boolean {
    if (state.limits.bombardedApproaches.includes(attackApproach)) {
        return false
    }
    const lastFired = state.artilleryFire[String(attackApproach)]
    if (lastFired === undefined || lastFired !== state.round - 1) {
        return true
    }
    const approach = state.map.approach(attackApproach)
    return state.map.locale(approach.locale).hill && !state.map.locale(approach.neighbour).hill
}

/**
 * A threat must be one the attacker can carry out whichever way the defender answers (rule 11,
 * step 1): by pieces already in the attack locale, by cavalry riding on along its road, or by
 * cavalry that can still ride up a road, stop in the attack locale and go on across the approach.
 */
export function canThreaten(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    attackApproach: number
): boolean {
    const approach = state.map.approach(attackApproach)
    const inPlace = [
        ...state.reserveUnits(approach.locale, playerId),
        ...state.blockers(approach.id, playerId)
    ]
    // Rule 11, step 2: the fixed battery cannot follow up a retreat, so it threatens only where it could fire.
    const standing = inPlace.some(
        (unit) =>
            hasUsableCommand(state, unit) &&
            (!unit.fixed || artilleryMayFire(state, attackApproach))
    )
    return standing || roadAttackOrders(state, playerId, attackApproach).length > 0
}

export function hasUsableCommand(
    state: HydratedNapoleonsTriumphGameState,
    unit: ProjectedUnit
): boolean {
    if (!canBeCommanded(state, unit)) {
        return false
    }
    const commander = unit.commanderId === undefined ? undefined : state.commander(unit.commanderId)
    const leavesOthers = commander === undefined || state.corpsUnits(commander.id).length > 1
    const byCommander =
        commander !== undefined &&
        commanderCanCommand(state, commander) &&
        (!unit.fixed || leavesOthers)
    const independently = independentCommandsLeft(state, unit.playerId) > 0 && leavesOthers
    return byCommander || independently
}

function marchOrder(state: HydratedNapoleonsTriumphGameState): MoveOrder | undefined {
    const march = state.roadMarch
    return march
        ? {
              kind: march.kind,
              commanderId: march.commanderId,
              unitIds: [...march.unitIds],
              road: [],
              continues: true
          }
        : undefined
}

type AttackSite = Pick<Attack, 'attackerId' | 'attackApproach'>

/** One Corps Move, or the Unit Move of a single unit: the commands that can go by road (rule 9). */
function roadCommands(units: readonly ProjectedUnit[]): MoveOrder[] {
    const unitIds = units.map((unit) => unit.id)
    const [first] = units
    const commands: MoveOrder[] = []
    if (
        first.commanderId !== undefined &&
        units.every((unit) => unit.commanderId === first.commanderId)
    ) {
        commands.push({ kind: CommandKind.Corps, commanderId: first.commanderId, unitIds })
    }
    if (units.length === 1) {
        commands.push({ kind: CommandKind.Unit, unitIds })
    }
    return commands
}

function roadRoutes(
    state: HydratedNapoleonsTriumphGameState,
    site: AttackSite,
    units: readonly ProjectedUnit[]
): Pick<MoveOrder, 'road' | 'entryId'>[] {
    const to = state.map.approach(site.attackApproach).locale
    const start = units[0].position
    if (start !== undefined) {
        const onward = state.map
            .roadPathsFrom(start.locale)
            .filter((road) => road[road.length - 1] === to)
        return start.locale === to ? [{ road: [] }] : onward.map((road) => ({ road }))
    }
    return state.map.entries(state.sideOf(site.attackerId)).flatMap((entry) => {
        const beyond = state.map.roadPathsFrom(entry.locale).map((road) => [entry.locale, ...road])
        return [[entry.locale], ...beyond]
            .filter((road) => road[road.length - 1] === to)
            .map((road) => ({ road, entryId: entry.id }))
    })
}

export function roadAttackOrder(
    state: HydratedNapoleonsTriumphGameState,
    site: AttackSite,
    units: readonly ProjectedUnit[]
): MoveOrder | undefined {
    if (
        units.length === 0 ||
        units.some(
            (unit) => !samePosition(unit.position, units[0].position) && unit.position !== undefined
        )
    ) {
        return undefined
    }
    const riding = marchOrder(state)
    const candidates =
        riding &&
        riding.unitIds.length === units.length &&
        units.every((unit) => riding.unitIds.includes(unit.id))
            ? [riding]
            : roadCommands(units).flatMap((command) =>
                  roadRoutes(state, site, units).map((route) => ({ ...command, ...route }))
              )
    return candidates.find((order) => isLegal(() => resolveAttackOrders(state, site, [order])))
}

function loneRiders(state: HydratedNapoleonsTriumphGameState, site: AttackSite): MoveOrder[] {
    const attackLocale = state.map.approach(site.attackApproach).locale
    if (state.freeCapacity(attackLocale, site.attackerId) < 1) {
        return []
    }
    return state
        .unitsOf(site.attackerId)
        .filter(
            (unit) =>
                unit.position?.locale !== attackLocale &&
                (unit.position === undefined || inReserve(unit.position)) &&
                faceOf(unit).type === UnitType.Cavalry
        )
        .flatMap((unit) => roadAttackOrder(state, site, [unit]) ?? [])
}

function roadAttackOrders(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    attackApproach: number
): MoveOrder[] {
    const site = { attackerId: playerId, attackApproach }
    const riding = marchOrder(state)
    const ridingOn =
        riding && isLegal(() => resolveAttackOrders(state, site, [riding])) ? [riding] : []
    return [...ridingOn, ...loneRiders(state, site)]
}
