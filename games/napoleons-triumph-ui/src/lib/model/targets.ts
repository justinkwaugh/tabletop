import {
    CommandKind,
    UnitType,
    canThreaten,
    inReserve,
    isLegal,
    resolveAttackOrders,
    resolveOrder,
    roadAttackOrder,
    traceRoadMove,
    validateMove,
    type HydratedNapoleonsTriumphGameState,
    type MoveOrder,
    type Position
} from '@tabletop/napoleons-triumph'

export enum TargetKind {
    Reserve = 'Reserve',
    Approach = 'Approach',
    Attack = 'Attack',
    Retreat = 'Retreat'
}

type ReservePosition = Pick<Position, 'locale'>
type ApproachPosition = Required<Position>

interface Route {
    road?: number[]
    entryId?: string
}

export interface ReserveTarget extends Route {
    key: string
    kind: TargetKind.Reserve
    position: ReservePosition
}

export interface ApproachTarget extends Route {
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

export type MoveTarget = ReserveTarget | ApproachTarget | AttackTarget | RetreatTarget

export enum TargetMark {
    Move = 'move',
    RoadMarch = 'road march',
    Approach = 'approach',
    Threat = 'threat'
}

const LEGEND_ORDER = [TargetMark.Move, TargetMark.RoadMarch, TargetMark.Approach, TargetMark.Threat]

export function markOf(target: MoveTarget): TargetMark {
    switch (target.kind) {
        case TargetKind.Attack:
            return TargetMark.Threat
        case TargetKind.Approach:
            return TargetMark.Approach
        case TargetKind.Reserve:
            return target.road === undefined ? TargetMark.Move : TargetMark.RoadMarch
        case TargetKind.Retreat:
            return TargetMark.Move
    }
}

export function marksOn(targets: readonly MoveTarget[]): TargetMark[] {
    const drawn = new Set(targets.map(markOf))
    return LEGEND_ORDER.filter((mark) => drawn.has(mark))
}

export function threatenedApproaches(targets: readonly MoveTarget[]): number[] {
    return targets.flatMap((target) =>
        target.kind === TargetKind.Attack ? [target.position.approach] : []
    )
}

function keyOf(kind: TargetKind, position: Position): string {
    return `${kind}:${position.locale}:${position.approach ?? 'r'}`
}

export function reserveTarget(locale: number, route: Route = {}): ReserveTarget {
    const position = { locale }
    return {
        key: keyOf(TargetKind.Reserve, position),
        kind: TargetKind.Reserve,
        position,
        ...route
    }
}

export function approachTarget(position: ApproachPosition, route: Route = {}): ApproachTarget {
    return {
        key: keyOf(TargetKind.Approach, position),
        kind: TargetKind.Approach,
        position,
        ...route
    }
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

function roadTargets(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder,
    start: Position | undefined,
    entryId?: string
): MoveTarget[] {
    if (order.kind === CommandKind.Detach) {
        return []
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
    const targets: MoveTarget[] = []
    for (const road of paths) {
        const locale = road[road.length - 1]
        const roadOrder: MoveOrder = { ...order, road, entryId }
        const oneStepOnFoot = start !== undefined && road.length === 1 && !order.continues
        if (!oneStepOnFoot && isLegal(() => validateMove(state, playerId, roadOrder, { locale }))) {
            targets.push(reserveTarget(locale, { road, entryId }))
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
                targets.push(approachTarget(position, { road, entryId }))
            }
            const rides =
                !order.continues &&
                roadAttackOrder(
                    state,
                    { attackerId: playerId, attackApproach: approach },
                    units
                ) !== undefined
            if (rides && mayThreaten(state, playerId, approach)) {
                targets.push(attackTarget(position))
            }
        }
    }
    return targets
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

function roadLength(target: MoveTarget): number {
    return target.kind === TargetKind.Reserve || target.kind === TargetKind.Approach
        ? (target.road?.length ?? 0)
        : 0
}

function byShortestRoad(targets: readonly MoveTarget[]): MoveTarget[] {
    const shortest = new Map<string, MoveTarget>()
    for (const candidate of targets) {
        const known = shortest.get(candidate.key)
        if (!known || roadLength(candidate) < roadLength(known)) {
            shortest.set(candidate.key, candidate)
        }
    }
    return [...shortest.values()]
}

export function moveTargets(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder,
    entryIds: readonly string[] = []
): MoveTarget[] {
    if (!isLegal(() => resolveOrder(state, playerId, order))) {
        return []
    }
    const { start } = resolveOrder(state, playerId, order)
    const targets =
        start === undefined
            ? entryIds.flatMap((entryId) => roadTargets(state, playerId, order, undefined, entryId))
            : [
                  ...localTargets(state, playerId, order, start),
                  ...(inReserve(start) ? roadTargets(state, playerId, order, start) : [])
              ]
    return byShortestRoad(targets)
}
