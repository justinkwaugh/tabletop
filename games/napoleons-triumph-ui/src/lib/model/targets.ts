import {
    CommandKind,
    UnitType,
    canThreaten,
    inReserve,
    isLegal,
    resolveAttackOrders,
    resolveOrder,
    roadAttackOrder,
    roadWake,
    sameRoadWake,
    traceRoadMove,
    validateMove,
    type HydratedNapoleonsTriumphGameState,
    type MoveOrder,
    type Position,
    type RoadWake
} from '@tabletop/napoleons-triumph'
import { firstOfEach } from '$lib/utils/ids.js'
import type { Way, WayStep } from './ways.js'

export enum TargetKind {
    Reserve = 'Reserve',
    Approach = 'Approach',
    Attack = 'Attack',
    Retreat = 'Retreat',
    Way = 'Way'
}

type ReservePosition = Pick<Position, 'locale'>
type ApproachPosition = Required<Position>

interface ByRoad {
    /** The ways there by road that leave something different behind (rule 10), the shortest first; absent for a place gone to on foot. */
    ways?: Way[]
}

export interface ReserveTarget extends ByRoad {
    key: string
    kind: TargetKind.Reserve
    position: ReservePosition
}

export interface ApproachTarget extends ByRoad {
    key: string
    kind: TargetKind.Approach
    position: ApproachPosition
}

export interface AttackTarget {
    key: string
    kind: TargetKind.Attack
    position: ApproachPosition
}

export interface RetreatTarget {
    key: string
    kind: TargetKind.Retreat
    position: ReservePosition
}

/** A step of the way to a place already chosen, offered where its ways part. */
export interface WayTarget {
    key: string
    kind: TargetKind.Way
    position: ReservePosition
    step: WayStep
}

export type MarchTarget = ReserveTarget | ApproachTarget

export type MoveTarget = MarchTarget | AttackTarget | RetreatTarget | WayTarget

export enum TargetMark {
    Move = 'move',
    RoadMarch = 'road march',
    Way = 'way',
    Approach = 'approach',
    Threat = 'threat',
    ClosedReserve = 'closed reserve'
}

const LEGEND_ORDER = [
    TargetMark.Move,
    TargetMark.RoadMarch,
    TargetMark.Way,
    TargetMark.Approach,
    TargetMark.Threat,
    TargetMark.ClosedReserve
]

export function markOf(target: MoveTarget): TargetMark {
    switch (target.kind) {
        case TargetKind.Attack:
            return TargetMark.Threat
        case TargetKind.Approach:
            return TargetMark.Approach
        case TargetKind.Reserve:
            return target.ways === undefined ? TargetMark.Move : TargetMark.RoadMarch
        case TargetKind.Retreat:
            return TargetMark.Move
        case TargetKind.Way:
            return TargetMark.Way
    }
}

export function marksOn(
    targets: readonly MoveTarget[],
    closedReserves: readonly number[] = []
): TargetMark[] {
    const drawn = new Set(targets.map(markOf))
    if (closedReserves.length > 0) {
        drawn.add(TargetMark.ClosedReserve)
    }
    return LEGEND_ORDER.filter((mark) => drawn.has(mark))
}

export function placeReachedSeveralWays(
    targets: readonly MoveTarget[],
    key: string | undefined
): MarchTarget | undefined {
    for (const target of targets) {
        const isPlace = target.kind === TargetKind.Reserve || target.kind === TargetKind.Approach
        if (isPlace && target.key === key && (target.ways?.length ?? 0) > 1) {
            return target
        }
    }
    return undefined
}

export function threatenedApproaches(targets: readonly MoveTarget[]): number[] {
    return targets.flatMap((target) =>
        target.kind === TargetKind.Attack ? [target.position.approach] : []
    )
}

function keyOf(kind: TargetKind, position: Position): string {
    return `${kind}:${position.locale}:${position.approach ?? 'r'}`
}

export function reserveTarget(locale: number, ways?: Way[]): ReserveTarget {
    const position = { locale }
    return { key: keyOf(TargetKind.Reserve, position), kind: TargetKind.Reserve, position, ways }
}

export function approachTarget(position: ApproachPosition, ways?: Way[]): ApproachTarget {
    return { key: keyOf(TargetKind.Approach, position), kind: TargetKind.Approach, position, ways }
}

export function wayTargets(steps: readonly WayStep[]): WayTarget[] {
    return steps.map((step) => ({
        key: step.key,
        kind: TargetKind.Way,
        position: { locale: step.locale },
        step
    }))
}

function attackTarget(position: ApproachPosition): AttackTarget {
    return { key: keyOf(TargetKind.Attack, position), kind: TargetKind.Attack, position }
}

export function retreatTargets(locales: Iterable<number>): RetreatTarget[] {
    return [...locales].map((locale) => {
        const position = { locale }
        return { key: keyOf(TargetKind.Retreat, position), kind: TargetKind.Retreat, position }
    })
}

function mayThreaten(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    approachId: number
): boolean {
    const approach = state.map.approach(approachId)
    return (
        !approach.impassable &&
        !state.currentRound.night &&
        state.isEnemyOccupied(approach.neighbour, playerId) &&
        !state.limits.closedApproaches.includes(approachId) &&
        canThreaten(state, playerId, approachId)
    )
}

function ownRoadPaths(
    state: HydratedNapoleonsTriumphGameState,
    from: number,
    playerId: string
): number[][] {
    return state.map
        .roadPathsFrom(from)
        .filter((path) => path.every((locale) => !state.isEnemyOccupied(locale, playerId)))
}

interface March {
    place: MarchTarget
    way: Way
    wake: RoadWake
}

function roadMoves(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder,
    start: Position | undefined,
    entryId?: string
): { marches: March[]; threats: AttackTarget[] } {
    const marches: March[] = []
    const threats: AttackTarget[] = []
    if (order.kind === CommandKind.Detach) {
        return { marches, threats }
    }
    const entry = entryId === undefined ? undefined : state.map.findEntry(entryId)
    const paths = start
        ? ownRoadPaths(state, start.locale, playerId)
        : entry && !state.isEnemyOccupied(entry.locale, playerId)
          ? [
                [entry.locale],
                ...ownRoadPaths(state, entry.locale, playerId).map((path) => [
                    entry.locale,
                    ...path
                ])
            ]
          : []
    const units = order.unitIds.map((id) => state.unit(id))
    const cavalry = units.every((unit) => unit.face?.type === UnitType.Cavalry)
    for (const road of paths) {
        const locale = road[road.length - 1]
        const roadOrder: MoveOrder = { ...order, road, entryId }
        const march = (place: MarchTarget): March => ({
            place,
            way: { road, entryId },
            wake: roadWake(state, resolveOrder(state, playerId, roadOrder), road)
        })
        const oneStepOnFoot = start !== undefined && road.length === 1 && !order.continues
        if (!oneStepOnFoot && isLegal(() => validateMove(state, playerId, roadOrder, { locale }))) {
            marches.push(march(reserveTarget(locale)))
        }
        if (
            !cavalry ||
            !isLegal(() => traceRoadMove(state, resolveOrder(state, playerId, roadOrder), road))
        ) {
            continue
        }
        const arrivals = traceRoadMove(state, resolveOrder(state, playerId, roadOrder), road)
        for (const approach of state.map.approachesOnRoad(arrivals)) {
            const position = { locale, approach }
            if (isLegal(() => validateMove(state, playerId, roadOrder, position))) {
                marches.push(march(approachTarget(position)))
            }
            const rides =
                !order.continues &&
                roadAttackOrder(
                    state,
                    { attackerId: playerId, attackApproach: approach },
                    units
                ) !== undefined
            if (rides && mayThreaten(state, playerId, approach)) {
                threats.push(attackTarget(position))
            }
        }
    }
    return { marches, threats }
}

/** Rule 10: ways to one place that leave the same behind are one way, and the shortest stands for them. */
function waysApart(marches: readonly March[]): Way[] {
    const apart: March[] = []
    for (const march of marches.toSorted((a, b) => a.way.road.length - b.way.road.length)) {
        if (!apart.some((kept) => sameRoadWake(kept.wake, march.wake))) {
            apart.push(march)
        }
    }
    return apart.map((march) => march.way)
}

function marchTargets(marches: readonly March[]): MarchTarget[] {
    const places = firstOfEach(
        marches.map((march) => march.place),
        (place) => place.key
    )
    return places.map((place) => ({
        ...place,
        ways: waysApart(marches.filter((march) => march.place.key === place.key))
    }))
}

function localTargets(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder,
    start: Position
): MoveTarget[] {
    const approaches = inReserve(start)
        ? state.map.passableApproachesOf(start.locale)
        : state.map.approachesOf(start.locale).filter((approach) => approach.id === start.approach)
    const targets: MoveTarget[] = []
    for (const approach of approaches) {
        const across = { locale: approach.neighbour }
        const block = { locale: start.locale, approach: approach.id }
        const site = { attackerId: playerId, attackApproach: approach.id }
        const ridesOn =
            !order.continues ||
            isLegal(() => resolveAttackOrders(state, site, [{ ...order, road: [] }]))
        if (state.isEnemyOccupied(approach.neighbour, playerId)) {
            if (ridesOn && mayThreaten(state, playerId, approach.id)) {
                targets.push(attackTarget(block))
            }
        } else if (isLegal(() => validateMove(state, playerId, order, across))) {
            targets.push(reserveTarget(across.locale))
        }
        if (inReserve(start) && isLegal(() => validateMove(state, playerId, order, block))) {
            targets.push(approachTarget(block))
        }
    }
    const reserve = { locale: start.locale }
    if (!inReserve(start) && isLegal(() => validateMove(state, playerId, order, reserve))) {
        targets.push(reserveTarget(reserve.locale))
    }
    return targets
}

/** Erratum to rule 11: artillery units given a Unit Move each can do one thing together, which is to attack across the approach they block. */
function targetsOfUnitsFiringTogether(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    unitIds: readonly string[]
): MoveTarget[] {
    const [first] = unitIds
    const position = state.unit(first).position
    if (position?.approach === undefined) {
        return []
    }
    const block = { locale: position.locale, approach: position.approach }
    const site = { attackerId: playerId, attackApproach: position.approach }
    const orders = unitIds.map((unitId) => ({ kind: CommandKind.Unit, unitIds: [unitId] }))
    return mayThreaten(state, playerId, position.approach) &&
        isLegal(() => resolveAttackOrders(state, site, orders))
        ? [attackTarget(block)]
        : []
}

export function moveTargets(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder,
    entryIds: readonly string[] = []
): MoveTarget[] {
    if (order.kind === CommandKind.Unit && order.unitIds.length > 1) {
        return targetsOfUnitsFiringTogether(state, playerId, order.unitIds)
    }
    if (!isLegal(() => resolveOrder(state, playerId, order))) {
        return []
    }
    const { start } = resolveOrder(state, playerId, order)
    const byRoad =
        start === undefined
            ? entryIds.map((entryId) => roadMoves(state, playerId, order, undefined, entryId))
            : inReserve(start)
              ? [roadMoves(state, playerId, order, start)]
              : []
    const onFoot = start === undefined ? [] : localTargets(state, playerId, order, start)
    const reachedOnFoot = new Set(onFoot.map((target) => target.key))
    const byRoadOnly = marchTargets(byRoad.flatMap((moves) => moves.marches)).filter(
        (march) => !reachedOnFoot.has(march.key)
    )
    const onFootOrThreatened = firstOfEach(
        [...onFoot, ...byRoad.flatMap((moves) => moves.threats)],
        (target) => target.key
    )
    return [...onFootOrThreatened, ...byRoadOnly]
}
