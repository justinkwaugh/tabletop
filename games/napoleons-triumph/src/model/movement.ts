import { assert } from '@tabletop/common'
import type { ApproachId, LocaleId, RoadArrival } from '../components/battleMap.js'
import { FRENCH_REINFORCEMENT_MORALE, Side, UnitType } from '../components/pieces.js'
import { CommandKind, type MoveOrder } from './attack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import {
    expendOrder,
    mayEnter,
    movingCommander,
    resolveOrder,
    type ResolvedOrder
} from './orders.js'
import { faceOf, inReserve, reserveOf, type Position, type ProjectedUnit } from './pieces.js'

export function allCavalry(units: readonly ProjectedUnit[]): boolean {
    return units.every((unit) => faceOf(unit).type === UnitType.Cavalry)
}

/** A corps of two or more units is subject to the road march restrictions (rule 10). */
export function isLargeCorps(resolved: ResolvedOrder): boolean {
    return resolved.order.kind === CommandKind.Corps && resolved.units.length >= 2
}

export function isReinforcement(resolved: ResolvedOrder): boolean {
    return resolved.start === undefined
}

/** Whether a player's pieces may come into a locale's reserve this turn, short of attacking. */
export function reserveOpenTo(
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

/**
 * Validates the locales a road move passes through, short of where it ends. `path` are the
 * locales entered. Returns the roads the move may be standing on at the end.
 */
export function traceRoadMove(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder,
    path: readonly LocaleId[]
): RoadArrival[] {
    const { order, units, start } = resolved
    const playerId = units[0].playerId
    assert(order.kind !== CommandKind.Detach, 'Detached units cannot move by road')
    let arrivals: RoadArrival[]
    if (start === undefined) {
        assert(order.entryId !== undefined, 'Reinforcements enter by a road at the map edge')
        const entry = state.map.findEntry(order.entryId)
        assert(entry?.side === state.sideOf(playerId), 'That is not an entry for this army')
        arrivals = state.map.traceRoad({ entryId: order.entryId }, [...path])
    } else {
        assert(order.entryId === undefined, 'Only reinforcements use an entry')
        assert(inReserve(start), 'A road move starts in reserve')
        arrivals = state.map.traceRoad(start.locale, [...path])
    }
    assert(arrivals.length > 0, 'No connected road covers that move')
    const large = isLargeCorps(resolved)
    path.forEach((locale, index) => {
        assert(reserveOpenTo(state, playerId, locale), `Locale ${locale} cannot be entered`)
        // Erratum to rule 8: a move may pass through a locale too small for it, but not a full one.
        assert(
            index === path.length - 1 || state.freeCapacity(locale, playerId) > 0,
            `Locale ${locale} is full and cannot be passed through`
        )
        if (!large) {
            return
        }
        assert(
            !state.reserveUnits(locale, playerId).some((unit) => unit.enteredReserveThisTurn),
            `Units already moved into the reserve of locale ${locale} this turn`
        )
        const mustStop = state.map
            .adjacentLocales(locale)
            .some((adjacent) => state.hasLargeCorps(adjacent, state.opponentOf(playerId).playerId))
        assert(
            !mustStop || index === path.length - 1,
            `A corps must halt in locale ${locale}, next to an enemy corps`
        )
    })
    return arrivals
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

/** Validates a move that makes no attack. Returns the locales entered by road, if any. */
export function validateMove(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder,
    to: Position
): ResolvedOrder {
    const resolved = resolveOrder(state, playerId, order)
    const { start } = resolved
    if (to.approach !== undefined) {
        const approach = state.map.approach(to.approach)
        assert(approach.locale === to.locale, 'That approach is in another locale')
        assert(!approach.impassable, 'An impassable approach cannot be blocked')
    }
    if (start === undefined) {
        assert(resolved.commander === undefined || mayEnter(state, resolved.commander.id), 'That corps has not arrived yet')
        assert(
            resolved.units.every(
                (unit) => unit.commanderId === undefined || mayEnter(state, unit.commanderId)
            ),
            'Those units have not arrived yet'
        )
        assert(order.road !== undefined, 'Reinforcements enter by road')
    }
    if (order.road !== undefined) {
        assert(order.road[order.road.length - 1] === to.locale, 'The road must end where the move ends')
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

function noteArrival(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder
): number {
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

/** Moves the commanded pieces and records everything the move changes for the rest of the turn. */
export function relocate(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder,
    to: Position,
    road?: readonly LocaleId[]
): MoveOutcome {
    const from = resolved.start
    const frenchMoraleGain = from === undefined ? noteArrival(state, resolved) : 0
    const commander = movingCommander(resolved)
    state.place(commander ? [...resolved.units, commander] : resolved.units, to)
    for (const unit of resolved.units) {
        unit.enteredReserveThisTurn = inReserve(to) ? true : undefined
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
    const resolved = validateMove(state, playerId, order, to)
    const outcome = relocate(state, resolved, to, order.road)
    expendOrder(state, resolved)
    return outcome
}

/** Approaches of a locale a piece standing in its reserve may step up to. */
export function blockableApproaches(
    state: HydratedNapoleonsTriumphGameState,
    locale: LocaleId
): ApproachId[] {
    return state.map.passableApproachesOf(locale).map((approach) => approach.id)
}

export function reservePosition(locale: LocaleId): Position {
    return reserveOf(locale)
}
