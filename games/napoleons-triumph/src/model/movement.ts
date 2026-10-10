import { assert, assertExists } from '@tabletop/common'
import {
    LOCAL_ROAD_REACH,
    MAIN_ROAD_REACH,
    type LocaleId,
    type RoadArrival
} from '../components/battleMap.js'
import { FRENCH_REINFORCEMENT_MORALE, Side, UnitType } from '../components/pieces.js'
import { CommandKind, type MoveOrder, type RoadMarch } from './attack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import {
    assertArrived,
    expendOrder,
    movingCommander,
    resolveOrder,
    type ResolvedOrder
} from './orders.js'
import { faceOf, inReserve, samePosition, type Position, type ProjectedUnit } from './pieces.js'

export function allCavalry(units: readonly ProjectedUnit[]): boolean {
    return units.every((unit) => faceOf(unit).type === UnitType.Cavalry)
}

/** A corps of two or more units is subject to the road march restrictions (rule 10). */
function isLargeCorps(resolved: ResolvedOrder): boolean {
    return resolved.order.kind === CommandKind.Corps && resolved.units.length >= 2
}

function reserveOpenTo(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    locale: LocaleId
): boolean {
    return (
        !state.isEnemyOccupied(locale, playerId) &&
        !state.limits.stormedLocales.includes(locale) &&
        !state.limits.marchedLocales.includes(locale)
    )
}

function checkRoom(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder,
    locale: LocaleId
) {
    const playerId = resolved.units[0].playerId
    const alreadyThere = resolved.start?.locale === locale
    const leaving = alreadyThere ? resolved.units.map((unit) => unit.id) : []
    assert(
        state.freeCapacity(locale, playerId, leaving) >= resolved.units.length,
        `Locale ${locale} cannot hold that many units`
    )
}

export function roadOrigin(resolved: ResolvedOrder): LocaleId | { entryId: string } {
    const { march, start, order } = resolved
    const startLocale = march ? march.start : start?.locale
    if (startLocale !== undefined) {
        return startLocale
    }
    const entryId = march ? march.entryId : order.entryId
    assertExists(entryId, 'Reinforcements enter by a road at the map edge')
    return { entryId }
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
    const { order, units, start, march } = resolved
    const playerId = units[0].playerId
    assert(order.kind !== CommandKind.Detach, 'Detached units cannot move by road')
    let from: LocaleId | undefined
    if (march) {
        from = march.path[march.path.length - 1]
    } else if (start === undefined) {
        assert(order.entryId !== undefined, 'Reinforcements enter by a road at the map edge')
        const entry = state.map.findEntry(order.entryId)
        assert(entry?.side === state.sideOf(playerId), 'That is not an entry for this army')
    } else {
        assert(order.entryId === undefined, 'Only reinforcements use an entry')
        assert(inReserve(start), 'A road move starts in reserve')
        from = start.locale
    }
    const arrivals = state.map.traceRoad(roadOrigin(resolved), [...(march?.path ?? []), ...path])
    assert(arrivals.length > 0, 'No connected road covers that move')
    const large = isLargeCorps(resolved)
    path.forEach((locale, index) => {
        const stopsHere = index === path.length - 1 && !attacking
        assert(reserveOpenTo(state, playerId, locale), `Locale ${locale} cannot be entered`)
        // Erratum to rule 8: a move may pass through a locale too small for it, but not a full one.
        assert(
            stopsHere || state.freeCapacity(locale, playerId) > 0,
            `Locale ${locale} is full and cannot be passed through`
        )
        const previous = index === 0 ? from : path[index - 1]
        if (attacking && previous !== undefined) {
            assert(
                !state.limits.closedApproaches.includes(
                    state.map.approachBetween(previous, locale).id
                ),
                'No attack move may cross an approach where an attack was turned back this turn'
            )
        }
        if (!large) {
            return
        }
        assert(
            !state.reserveUnits(locale, playerId).some((unit) => unit.enteredReserveThisTurn),
            `Units already moved into the reserve of locale ${locale} this turn`
        )
        assert(
            stopsHere || !mustHalt(state, playerId, locale),
            `A corps must halt in locale ${locale}, next to an enemy corps`
        )
    })
    return arrivals
}

function reach(arrivals: readonly RoadArrival[]): number {
    return arrivals.some((arrival) => arrival.main) ? MAIN_ROAD_REACH : LOCAL_ROAD_REACH
}

/** Ends the cavalry road move in progress, if any; its units are shown now that the move is over (rule 11). */
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
    const { order, units, start, march } = resolved
    const begun: RoadMarch = march ?? {
        kind: order.kind,
        commanderId: order.kind === CommandKind.Corps ? order.commanderId : undefined,
        unitIds: units.map((unit) => unit.id),
        start: start?.locale,
        entryId: order.entryId,
        path: [...entered]
    }
    const path = march ? [...march.path, ...entered] : [...entered]
    const arrivals = state.map.traceRoad(roadOrigin(resolved), path)
    const halted = isLargeCorps(resolved) && mustHalt(state, units[0].playerId, to.locale)
    state.roadMarch = { ...begun, path }
    if (!inReserve(to) || halted || arrivals.length === 0 || path.length >= reach(arrivals)) {
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
    assert(allCavalry(resolved.units), 'Only cavalry can end a road move blocking an approach')
    assert(
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
    assert(
        resolved.units.every((unit) => !unit.fixed),
        'The fixed battery cannot move'
    )
    if (to.approach !== undefined) {
        const approach = state.map.approach(to.approach)
        assert(approach.locale === to.locale, 'That approach is in another locale')
        assert(!approach.impassable, 'An impassable approach cannot be blocked')
    }
    if (resolved.march) {
        const road = order.road ?? []
        const here = resolved.march.path[resolved.march.path.length - 1]
        assert(
            to.locale === (road.length > 0 ? road[road.length - 1] : here),
            'The road must end where the move ends'
        )
        assert(road.length > 0 || to.approach !== undefined, 'The cavalry already stands there')
        const arrivals = traceRoadMove(state, resolved, road)
        validateRoadEnd(state, resolved, arrivals, to)
        if (road.length > 0) {
            checkRoom(state, resolved, to.locale)
        }
        return resolved
    }
    if (start === undefined) {
        assertArrived(state, resolved)
        assert(order.road !== undefined, 'Reinforcements enter by road')
    }
    if (order.road !== undefined) {
        assert(order.road.length > 0, 'A road move enters at least one locale')
        assert(
            order.road[order.road.length - 1] === to.locale,
            'The road must end where the move ends'
        )
        const arrivals = traceRoadMove(state, resolved, order.road)
        validateRoadEnd(state, resolved, arrivals, to)
        checkRoom(state, resolved, to.locale)
        return resolved
    }
    assert(start !== undefined, 'Reinforcements enter by road')
    if (start.locale === to.locale) {
        assert(
            inReserve(start) !== inReserve(to),
            'Within a locale a piece moves between the reserve and an approach'
        )
        if (inReserve(to)) {
            assert(
                !state.limits.marchedLocales.includes(to.locale),
                'A corps marched through that reserve this turn'
            )
        }
        return resolved
    }
    assert(inReserve(to), 'A piece enters another locale in reserve')
    const crossing = state.map.findApproachBetween(start.locale, to.locale)
    assert(crossing !== undefined && !crossing.impassable, 'Those locales are not connected')
    assert(
        inReserve(start) || start.approach === crossing.id,
        'A piece blocking an approach can only cross that approach'
    )
    assert(reserveOpenTo(state, playerId, to.locale), `Locale ${to.locale} cannot be entered`)
    checkRoom(state, resolved, to.locale)
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
    const playerId = resolved.units[0].playerId
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
    if (road && isLargeCorps(resolved)) {
        for (const locale of road) {
            if (!state.limits.marchedLocales.includes(locale)) {
                state.limits.marchedLocales.push(locale)
            }
        }
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
