import { assertExists } from '@tabletop/common'
import {
    LOCAL_ROAD_REACH,
    MAIN_ROAD_REACH,
    type LocaleId,
    type RoadArrival,
    type RoadOrigin
} from '../components/battleMap.js'
import { FRENCH_REINFORCEMENT_MORALE, Side, UnitType } from '../components/pieces.js'
import { CommandKind, type MoveOrder, type RoadMarch } from './attack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import {
    assertArrived,
    expendOrder,
    mayBeCommandedAgain,
    movingCommander,
    resolveOrder,
    type ResolvedOrder
} from './orders.js'
import { faceOf, inReserve, samePosition, type Position, type ProjectedUnit } from './pieces.js'
import { legal } from './legality.js'

export function allCavalry(units: readonly ProjectedUnit[]): boolean {
    return units.every((unit) => faceOf(unit).type === UnitType.Cavalry)
}

/** A corps of two or more units is subject to the road march restrictions (rule 10). */
function isLargeCorps(resolved: ResolvedOrder): boolean {
    return resolved.order.kind === CommandKind.Corps && resolved.units.length >= 2
}

/** Rule 10: a reserve a corps of two or more units marched into is closed to other units, not to the units that marched. */
function closedByAMarch(
    state: HydratedNapoleonsTriumphGameState,
    units: readonly ProjectedUnit[],
    locale: LocaleId
): boolean {
    return (
        state.limits.marchedLocales.includes(locale) &&
        !units.every((unit) => unit.marchedReserves?.includes(locale))
    )
}

function reserveOpenTo(
    state: HydratedNapoleonsTriumphGameState,
    { playerId, units }: ResolvedOrder,
    locale: LocaleId
): boolean {
    return (
        !state.isEnemyOccupied(locale, playerId) &&
        !state.limits.stormedLocales.includes(locale) &&
        !closedByAMarch(state, units, locale)
    )
}

/** Rule 8: a locale holds only so many units of an army; units already in it take up no more room. */
export function requireRoom(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    units: readonly ProjectedUnit[],
    locale: LocaleId
) {
    const alreadyThere = units.filter((unit) => unit.position?.locale === locale)
    legal(
        state.freeCapacity(
            locale,
            playerId,
            alreadyThere.map((unit) => unit.id)
        ) >= units.length,
        `Locale ${locale} cannot hold that many units`
    )
}

export function roadOrigin(resolved: ResolvedOrder): RoadOrigin {
    const { march, start, startRoads, order } = resolved
    const from = march
        ? { locale: march.start, roads: march.startRoads, entryId: march.entryId }
        : { locale: start?.locale, roads: startRoads, entryId: order.entryId }
    if (from.locale !== undefined) {
        return { locale: from.locale, roads: from.roads }
    }
    assertExists(from.entryId, 'Reinforcements enter by a road at the map edge')
    return { entryId: from.entryId }
}

function roadTaken(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder,
    entered: readonly LocaleId[]
): RoadArrival[] {
    return state.map.traceRoad(roadOrigin(resolved), [...(resolved.march?.path ?? []), ...entered])
}

/** A corps of two or more units halts on entering a locale next to an enemy corps of two or more (rule 10). */
function mustHalt(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    locale: LocaleId
): boolean {
    const enemyId = state.opponentOf(playerId).playerId
    return state.map
        .adjacentLocales(locale)
        .some((adjacent) => state.hasLargeCorps(adjacent, enemyId))
}

export function traceRoadMove(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder,
    path: readonly LocaleId[],
    attacking = false
): RoadArrival[] {
    const { order, playerId, start, march } = resolved
    legal(order.kind !== CommandKind.Detach, 'Detached units cannot move by road')
    let from: LocaleId | undefined
    if (march) {
        from = march.path[march.path.length - 1]
    } else if (start === undefined) {
        legal(order.entryId !== undefined, 'Reinforcements enter by a road at the map edge')
        const entry = state.map.findEntry(order.entryId)
        legal(entry?.side === state.sideOf(playerId), 'That is not an entry for this army')
    } else {
        legal(order.entryId === undefined, 'Only reinforcements use an entry')
        legal(inReserve(start), 'A road move starts in reserve')
        from = start.locale
    }
    const arrivals = roadTaken(state, resolved, path)
    legal(arrivals.length > 0, 'No connected road covers that move')
    const large = isLargeCorps(resolved)
    path.forEach((locale, index) => {
        const stopsHere = index === path.length - 1 && !attacking
        legal(reserveOpenTo(state, resolved, locale), `Locale ${locale} cannot be entered`)
        // Erratum to rule 8: a move may pass through a locale too small for it, but not a full one.
        legal(
            stopsHere || state.freeCapacity(locale, playerId) > 0,
            `Locale ${locale} is full and cannot be passed through`
        )
        const previous = index === 0 ? from : path[index - 1]
        if (attacking && previous !== undefined) {
            legal(
                !state.limits.closedApproaches.includes(
                    state.map.approachBetween(previous, locale).id
                ),
                'No attack move may cross an approach where an attack was turned back this turn'
            )
        }
        if (!large) {
            return
        }
        legal(
            !state.reserveUnits(locale, playerId).some((unit) => unit.enteredReserveThisTurn),
            `Units already moved into the reserve of locale ${locale} this turn`
        )
        legal(
            stopsHere || !mustHalt(state, playerId, locale),
            `A corps must halt in locale ${locale}, next to an enemy corps`
        )
    })
    return arrivals
}

function roadsArrivedBy(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder,
    entered: readonly LocaleId[]
): number[] {
    const roads = roadTaken(state, resolved, entered).flatMap((arrival) => arrival.group ?? [])
    return [...new Set(roads)]
}

function reach(arrivals: readonly RoadArrival[]): number {
    return arrivals.some((arrival) => arrival.main) ? MAIN_ROAD_REACH : LOCAL_ROAD_REACH
}

/** Rule 11: cavalry is shown when its road move is over. */
export function endRoadMarch(state: HydratedNapoleonsTriumphGameState) {
    const march = state.roadMarch
    if (!march) {
        return
    }
    state.revealAll(march.unitIds.flatMap((id) => state.findUnit(id) ?? []))
    state.roadMarch = undefined
}

export function settleRoadMarch(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder,
    entered: readonly LocaleId[],
    to: Position
) {
    const { order, playerId, units, start, startRoads, march } = resolved
    const begun: RoadMarch = march ?? {
        kind: order.kind,
        commanderId: movingCommander(resolved)?.id,
        unitIds: units.map((unit) => unit.id),
        start: start?.locale,
        startRoads,
        entryId: order.entryId,
        path: [...entered]
    }
    const path = march ? [...march.path, ...entered] : [...entered]
    const arrivals = roadTaken(state, resolved, entered)
    const halted = isLargeCorps(resolved) && mustHalt(state, playerId, to.locale)
    const stopped = halted || path.length >= reach(arrivals)
    const mayStillBlock = state.map
        .approachesOnRoad(arrivals)
        .some((approach) => !state.map.approach(approach).impassable)
    state.roadMarch = { ...begun, path, stopped: stopped ? true : undefined }
    if (!inReserve(to) || (stopped && !mayStillBlock)) {
        endRoadMarch(state)
    }
}

function validateRoadEnd(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder,
    arrivals: RoadArrival[],
    to: Position
) {
    if (to.approach === undefined) {
        return
    }
    legal(allCavalry(resolved.units), 'Only cavalry can end a road move blocking an approach')
    legal(
        state.map.approachesOnRoad(arrivals).includes(to.approach),
        'That approach is not crossed by the road the cavalry moved on'
    )
}

export function validateMove(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder,
    to: Position
): ResolvedOrder {
    const resolved = resolveOrder(state, playerId, order)
    const { start } = resolved
    legal(
        resolved.units.every((unit) => !unit.fixed),
        'The fixed battery cannot move'
    )
    if (to.approach !== undefined) {
        const approach = state.map.approach(to.approach)
        legal(approach.locale === to.locale, 'That approach is in another locale')
        legal(!approach.impassable, 'An impassable approach cannot be blocked')
    }
    if (resolved.march) {
        const road = order.road ?? []
        const here = resolved.march.path[resolved.march.path.length - 1]
        legal(
            !resolved.march.stopped || road.length === 0,
            'The cavalry has stopped and can only end blocking an approach of its locale'
        )
        legal(
            to.locale === (road.length > 0 ? road[road.length - 1] : here),
            'The road must end where the move ends'
        )
        legal(road.length > 0 || to.approach !== undefined, 'The cavalry already stands there')
        const arrivals = traceRoadMove(state, resolved, road)
        validateRoadEnd(state, resolved, arrivals, to)
        requireRoom(state, playerId, resolved.units, to.locale)
        return resolved
    }
    if (start === undefined) {
        assertArrived(state, resolved)
        legal(order.road !== undefined, 'Reinforcements enter by road')
    }
    if (order.road !== undefined) {
        legal(order.road.length > 0, 'A road move enters at least one locale')
        legal(
            order.road[order.road.length - 1] === to.locale,
            'The road must end where the move ends'
        )
        const arrivals = traceRoadMove(state, resolved, order.road)
        validateRoadEnd(state, resolved, arrivals, to)
        requireRoom(state, playerId, resolved.units, to.locale)
        return resolved
    }
    legal(start !== undefined, 'Reinforcements enter by road')
    if (start.locale === to.locale) {
        legal(
            inReserve(start) !== inReserve(to),
            'Within a locale a piece moves between the reserve and an approach'
        )
        if (inReserve(to)) {
            legal(
                !closedByAMarch(state, resolved.units, to.locale),
                'A corps marched through that reserve this turn'
            )
        }
        return resolved
    }
    legal(inReserve(to), 'A piece enters another locale in reserve')
    const crossing = state.map.findApproachBetween(start.locale, to.locale)
    legal(crossing !== undefined && !crossing.impassable, 'Those locales are not connected')
    legal(
        inReserve(start) || start.approach === crossing.id,
        'A piece blocking an approach can only cross that approach'
    )
    legal(reserveOpenTo(state, resolved, to.locale), `Locale ${to.locale} cannot be entered`)
    requireRoom(state, playerId, resolved.units, to.locale)
    return resolved
}

export interface MoveOutcome {
    from?: Position
    to: Position
    road?: LocaleId[]
    revealedCavalry: boolean
    frenchMoraleGain: number
}

function noteArrival(state: HydratedNapoleonsTriumphGameState, resolved: ResolvedOrder): number {
    const { playerId } = resolved
    for (const unit of resolved.units) {
        unit.enteredThisTurn = true
    }
    const commander = movingCommander(resolved)
    if (commander) {
        commander.enteredThisTurn = true
    }
    if (state.sideOf(playerId) !== Side.French || state.frenchReinforcementsEntered) {
        return 0
    }
    state.frenchReinforcementsEntered = true
    state.getPlayerState(playerId).morale += FRENCH_REINFORCEMENT_MORALE
    return FRENCH_REINFORCEMENT_MORALE
}

/** Rule 10: what a move by road leaves behind for the rest of the turn. Two ways to one place that leave the same behind are the same move. */
export interface RoadWake {
    /** The reserves a corps of two or more units marched into, closed to other units. */
    closedReserves: LocaleId[]
    /** The roads the pieces could go on by, if they can be commanded again this turn. */
    onwardRoads: number[]
}

function sameMembers(a: readonly number[], b: readonly number[]): boolean {
    return a.length === b.length && a.every((member) => b.includes(member))
}

export function sameRoadWake(a: RoadWake, b: RoadWake): boolean {
    return (
        sameMembers(a.closedReserves, b.closedReserves) && sameMembers(a.onwardRoads, b.onwardRoads)
    )
}

function reservesClosedBy(resolved: ResolvedOrder, entered: readonly LocaleId[]): LocaleId[] {
    return isLargeCorps(resolved) ? [...entered] : []
}

export function roadWake(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder,
    entered: readonly LocaleId[]
): RoadWake {
    return {
        closedReserves: reservesClosedBy(resolved, entered),
        onwardRoads: mayBeCommandedAgain(state, resolved)
            ? roadsArrivedBy(state, resolved, entered)
            : []
    }
}

function noteRoadTaken(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder,
    entered: readonly LocaleId[],
    to: Position
) {
    const closed = reservesClosedBy(resolved, entered)
    const arrivalRoads = roadsArrivedBy(state, resolved, entered)
    state.limits.marchedLocales = [...new Set([...state.limits.marchedLocales, ...closed])]
    for (const unit of resolved.units) {
        if (closed.length > 0) {
            unit.marchedReserves = [...new Set([...(unit.marchedReserves ?? []), ...closed])]
        }
        if (arrivalRoads.length > 0) {
            unit.arrivedByRoad = { locale: to.locale, roads: arrivalRoads }
        }
    }
}

export function relocate(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder,
    to: Position,
    road?: readonly LocaleId[]
): MoveOutcome {
    const from = resolved.start
    const frenchMoraleGain = from === undefined ? noteArrival(state, resolved) : 0
    const commander = movingCommander(resolved)
    const arriving = !samePosition(from, to)
    state.place(commander ? [...resolved.units, commander] : resolved.units, to)
    for (const unit of resolved.units) {
        // Forum ruling on rule 10: pieces that feint from reserve and stay there have not moved into it.
        if (arriving) {
            unit.enteredReserveThisTurn = inReserve(to) ? true : undefined
        }
    }
    if (road) {
        noteRoadTaken(state, resolved, road, to)
    }
    const revealedCavalry = road !== undefined && to.approach !== undefined
    if (revealedCavalry) {
        state.revealAll(resolved.units)
    }
    return { from, to, road: road ? [...road] : undefined, revealedCavalry, frenchMoraleGain }
}

export function executeMove(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder,
    to: Position
): MoveOutcome {
    if (!order.continues) {
        endRoadMarch(state)
    }
    const resolved = validateMove(state, playerId, order, to)
    const outcome = relocate(state, resolved, to, order.road)
    expendOrder(state, resolved)
    if (resolved.march) {
        settleRoadMarch(state, resolved, order.road ?? [], to)
    }
    return outcome
}
