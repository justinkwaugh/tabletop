import type { ApproachId, RoadArrival } from '../components/battleMap.js'
import { UnitType } from '../components/pieces.js'
import { CommandKind, type Attack, type MoveOrder } from './attack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { allCavalry, roadOrigin, traceRoadMove } from './movement.js'
import { isLegal, legal } from './legality.js'
import {
    assertArrived,
    corpsCommandsLeft,
    hasUsableCommand,
    independentCommandsLeft,
    resolveOrder,
    type ResolvedOrder
} from './orders.js'
import {
    areTheUnits,
    faceOf,
    inReserve,
    samePosition,
    type Position,
    type ProjectedUnit
} from './pieces.js'

export type AttackSite = Pick<Attack, 'attackerId' | 'attackApproach'>

export interface AttackOrders {
    commands: ResolvedOrder[]
    units: ProjectedUnit[]
    stance: Position
    byRoad: boolean
    /** Erratum to rule 11: two artillery Unit Moves combine only when both batteries lead the attack. */
    artilleryPair: boolean
}

/** Rule 11: an attack by road is one command of cavalry, riding from reserve along a road that goes on across the attack approach. */
function resolveRoadAttack(
    state: HydratedNapoleonsTriumphGameState,
    site: AttackSite,
    commands: ResolvedOrder[]
): AttackOrders {
    const [first] = commands
    const approach = state.map.approach(site.attackApproach)
    const reserve: Position = { locale: approach.locale }
    const path = first.order.road ?? []
    legal(commands.length === 1, 'A road attack is made by a single command')
    legal(allCavalry(first.units), 'Only cavalry can attack by road')
    legal(!first.march?.stopped, 'Cavalry that has stopped makes no further attack')
    if (path.length === 0) {
        legal(samePosition(first.start, reserve), 'A road attack starts in reserve')
    } else {
        legal(path[path.length - 1] === approach.locale, 'The road must lead to the attack locale')
    }
    if (first.start === undefined) {
        assertArrived(state, first)
    }
    traceRoadMove(state, first, path, true)
    const whole = [...(first.march?.path ?? []), ...path, approach.neighbour]
    legal(
        state.map.traceRoad(roadOrigin(first), whole).length > 0,
        'The road does not carry the cavalry across that approach'
    )
    return { commands, units: first.units, stance: reserve, byRoad: true, artilleryPair: false }
}

/** Rule 8: "A corps can never be just a commander", however many Unit Moves take its units away at once. */
function requireCommandersKeepAUnit(
    state: HydratedNapoleonsTriumphGameState,
    unitMoves: readonly ResolvedOrder[]
) {
    const leaving = unitMoves.flatMap((command) => command.units)
    for (const commanderId of new Set(leaving.flatMap((unit) => unit.commanderId ?? []))) {
        legal(
            state.corpsUnits(commanderId).some((unit) => !leaving.includes(unit)),
            'A commander cannot detach its last unit'
        )
    }
}

/** Rule 11: who attacks, from where, and whether several commands may be combined. */
export function resolveAttackOrders(
    state: HydratedNapoleonsTriumphGameState,
    site: AttackSite,
    orders: readonly MoveOrder[]
): AttackOrders {
    legal(orders.length > 0, 'An attack needs a command')
    const approach = state.map.approach(site.attackApproach)
    const commands = orders.map((order) => resolveOrder(state, site.attackerId, order))
    const units = commands.flatMap((command) => command.units)
    legal(new Set(units.map((unit) => unit.id)).size === units.length, 'A unit attacks once')
    const blocking: Position = { locale: approach.locale, approach: approach.id }
    const reserve: Position = { locale: approach.locale }

    const [first] = commands
    if (commands.some((command) => command.order.road !== undefined)) {
        return resolveRoadAttack(state, site, commands)
    }
    legal(
        commands.every((command) => command.march === undefined),
        'Cavalry riding on by road attacks by road'
    )

    const stance = first.start
    legal(
        samePosition(stance, blocking) || samePosition(stance, reserve),
        'Attackers must be in the attack locale, in reserve or blocking the attack approach'
    )
    legal(
        commands.every((command) => samePosition(command.start, stance)),
        'Combined commands must start in the same position'
    )
    const unitMoves = commands.filter((command) => command.order.kind === CommandKind.Unit)
    const artilleryPair =
        commands.length === 2 &&
        unitMoves.length === 2 &&
        samePosition(stance, blocking) &&
        units.every((unit) => faceOf(unit).type === UnitType.Artillery)
    if (commands.length > 1) {
        const allCorps = commands.every((command) => command.order.kind === CommandKind.Corps)
        legal(
            allCorps || artilleryPair,
            'Only Corps Moves, or two artillery Unit Moves on the attack approach, can be combined'
        )
        const commanders = new Set(commands.map((command) => command.order.commanderId))
        legal(!allCorps || commanders.size === commands.length, 'A commander gives one command')
        // Rule 11: each command in a combined move counts separately against the command limits.
        legal(
            unitMoves.length <= independentCommandsLeft(state, site.attackerId),
            'Not enough independent commands are left'
        )
        legal(
            commands.length - unitMoves.length <= corpsCommandsLeft(state, site.attackerId),
            'Not enough corps commands are left'
        )
        requireCommandersKeepAUnit(state, unitMoves)
    }
    legal(stance !== undefined, 'Attackers must be on the map')
    return { commands, units, stance, byRoad: false, artilleryPair }
}

/** Rule 11, step 5: artillery may not lead from one attack approach in consecutive rounds unless it fires down from a hill, nor twice across it in one turn. */
export function artilleryMayFire(
    state: HydratedNapoleonsTriumphGameState,
    attackApproach: ApproachId
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

/** Rule 6, step 9: the fixed battery never moves, so it attacks only by firing: it can neither follow up a retreat nor press an attack where it may not fire. */
export function mayAttackInPlace(
    state: HydratedNapoleonsTriumphGameState,
    unit: ProjectedUnit,
    attackApproach: ApproachId
): boolean {
    return hasUsableCommand(state, unit) && (!unit.fixed || artilleryMayFire(state, attackApproach))
}

/** Rule 11, step 1: a threat must be one the attacker can carry out whichever way the defender answers. */
export function canThreaten(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    attackApproach: ApproachId
): boolean {
    const approach = state.map.approach(attackApproach)
    const inPlace = [
        ...state.reserveUnits(approach.locale, playerId),
        ...state.blockers(approach.id, playerId)
    ]
    const standing = inPlace.some((unit) => mayAttackInPlace(state, unit, attackApproach))
    return standing || roadThreats(state, playerId, attackApproach).length > 0
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

/**
 * Rule 9: a Corps Move or the Unit Move of a single unit can go by road. A unit named by itself
 * leaves its corps to do so; its commander goes along only when the units named are the whole corps.
 */
function roadCommands(
    state: HydratedNapoleonsTriumphGameState,
    units: readonly ProjectedUnit[]
): MoveOrder[] {
    const unitIds = units.map((unit) => unit.id)
    const [{ commanderId }] = units
    const oneCorps =
        commanderId !== undefined && units.every((unit) => unit.commanderId === commanderId)
    const corpsMove = oneCorps ? [{ kind: CommandKind.Corps, commanderId, unitIds }] : []
    const unitMove = units.length === 1 ? [{ kind: CommandKind.Unit, unitIds }] : []
    const wholeCorps = oneCorps && state.corpsUnits(commanderId).length === units.length
    return wholeCorps ? [...corpsMove, ...unitMove] : [...unitMove, ...corpsMove]
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

/** Rule 11: cavalry riding on by road may threaten again under the command it rides by. */
export function rideOnAttackOrder(
    state: HydratedNapoleonsTriumphGameState,
    site: AttackSite,
    units: readonly ProjectedUnit[]
): MoveOrder | undefined {
    const ride = marchOrder(state)
    return ride !== undefined &&
        areTheUnits(ride.unitIds, units) &&
        isLegal(() => resolveAttackOrders(state, site, [ride]))
        ? ride
        : undefined
}

function arrivalsBeyond(
    state: HydratedNapoleonsTriumphGameState,
    site: AttackSite,
    order: MoveOrder
): RoadArrival[] {
    const { neighbour } = state.map.approach(site.attackApproach)
    const origin = roadOrigin(resolveOrder(state, site.attackerId, order))
    return state.map.traceRoad(origin, [...(order.road ?? []), neighbour])
}

function leavesOpenAll(open: readonly RoadArrival[], others: readonly RoadArrival[]): boolean {
    return others.every((other) =>
        open.some((arrival) => arrival.group === other.group && arrival.main === other.main)
    )
}

/** More than one road carries an attack only for reinforcements coming on where entry roads meet. The road taken is one that leaves the cavalry every road beyond that the others do; `austerlitz.spec.ts` checks the map always has one. */
function widestRoad(
    state: HydratedNapoleonsTriumphGameState,
    site: AttackSite,
    orders: readonly MoveOrder[]
): MoveOrder | undefined {
    const beyond = orders.map((order) => arrivalsBeyond(state, site, order))
    const widest = beyond.findIndex((open) => beyond.every((other) => leavesOpenAll(open, other)))
    return orders.at(Math.max(widest, 0))
}

/** Rule 9: the commands by which cavalry not yet on the road could attack by road. */
export function roadAttackOrders(
    state: HydratedNapoleonsTriumphGameState,
    site: AttackSite,
    units: readonly ProjectedUnit[]
): MoveOrder[] {
    const [first] = units
    if (
        first === undefined ||
        units.some(
            (unit) => unit.position !== undefined && !samePosition(unit.position, first.position)
        )
    ) {
        return []
    }
    const mayAttack = (order: MoveOrder) => isLegal(() => resolveAttackOrders(state, site, [order]))
    const routes = roadRoutes(state, site, units)
    return roadCommands(state, units).flatMap(
        (command) =>
            widestRoad(
                state,
                site,
                routes.map((route) => ({ ...command, ...route })).filter(mayAttack)
            ) ?? []
    )
}

export function roadAttackOrder(
    state: HydratedNapoleonsTriumphGameState,
    site: AttackSite,
    units: readonly ProjectedUnit[],
    wanted?: CommandKind
): MoveOrder | undefined {
    const orders = roadAttackOrders(state, site, units)
    return orders.find((order) => order.kind === wanted) ?? orders[0]
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

function roadThreats(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    attackApproach: ApproachId
): MoveOrder[] {
    const site = { attackerId: playerId, attackApproach }
    const ride = rideOnAttackOrder(state, site, state.riders())
    return [...(ride ? [ride] : []), ...loneRiders(state, site)]
}
