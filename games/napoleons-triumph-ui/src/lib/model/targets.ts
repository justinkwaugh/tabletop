import {
    CommandKind,
    UnitType,
    inReserve,
    resolveOrder,
    samePosition,
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

/** Something on the board the selected order can be sent to. */
export interface MoveTarget {
    key: string
    kind: TargetKind
    /** Where the pieces end: a position for a move, the attack approach's position for an attack. */
    position: Position
    /** Locales entered by road, when the target is reached by a road move. */
    road?: number[]
    entryId?: string
}

function legal(check: () => void): boolean {
    try {
        check()
        return true
    } catch {
        return false
    }
}

function positionKey(kind: TargetKind, position: Position): string {
    return `${kind}:${position.locale}:${position.approach ?? 'r'}`
}

function canAttackAcross(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    approachId: number
): boolean {
    const approach = state.map.approach(approachId)
    return (
        !approach.impassable &&
        !state.currentRound.night &&
        state.isEnemyOccupied(approach.neighbour, playerId) &&
        !state.limits.closedApproaches.includes(approachId)
    )
}

function roadPaths(
    state: HydratedNapoleonsTriumphGameState,
    from: number,
    playerId: string
): number[][] {
    const paths: number[][] = []
    const extend = (path: number[], locale: number) => {
        if (path.length >= 3) {
            return
        }
        for (const next of new Set(state.map.roadLinksFrom(locale).map((link) => link.to))) {
            if (path.includes(next) || next === from || state.isEnemyOccupied(next, playerId)) {
                continue
            }
            const longer = [...path, next]
            paths.push(longer)
            extend(longer, next)
        }
    }
    extend([], from)
    return paths
}

function allCavalry(state: HydratedNapoleonsTriumphGameState, order: MoveOrder): boolean {
    return order.unitIds.every((id) => state.unit(id).face?.type === UnitType.Cavalry)
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
    const targets: MoveTarget[] = []
    const paths: number[][] = []
    if (start) {
        paths.push(...roadPaths(state, start.locale, playerId))
    } else if (entryId) {
        const entry = state.map.findEntry(entryId)
        if (entry && !state.isEnemyOccupied(entry.locale, playerId)) {
            paths.push([entry.locale])
            paths.push(...roadPaths(state, entry.locale, playerId).map((path) => [entry.locale, ...path]))
        }
    }
    const cavalry = allCavalry(state, order)
    for (const road of paths) {
        const locale = road[road.length - 1]
        const roadOrder: MoveOrder = { ...order, road, entryId }
        const ordinary = start !== undefined && road.length === 1
        if (!ordinary && legal(() => validateMove(state, playerId, roadOrder, { locale }))) {
            targets.push({ key: positionKey(TargetKind.Reserve, { locale }), kind: TargetKind.Reserve, position: { locale }, road, entryId })
        }
        if (!cavalry) {
            continue
        }
        const arrivals = legal(() => traceRoadMove(state, resolveOrder(state, playerId, roadOrder), road))
            ? traceRoadMove(state, resolveOrder(state, playerId, roadOrder), road)
            : []
        for (const approach of state.map.approachesOnRoad(arrivals)) {
            const position = { locale, approach }
            if (legal(() => validateMove(state, playerId, roadOrder, position))) {
                targets.push({ key: positionKey(TargetKind.Approach, position), kind: TargetKind.Approach, position, road, entryId })
            }
            if (start !== undefined && canAttackAcross(state, playerId, approach)) {
                targets.push({ key: positionKey(TargetKind.Attack, position), kind: TargetKind.Attack, position, road })
            }
        }
    }
    return targets
}

/** Every place the given order could go this turn, each reached the simplest way. */
export function moveTargets(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder,
    entryIds: readonly string[] = []
): MoveTarget[] {
    const resolved = legal(() => resolveOrder(state, playerId, order))
        ? resolveOrder(state, playerId, order)
        : undefined
    if (!resolved) {
        return []
    }
    const start = resolved.start
    const targets: MoveTarget[] = []
    if (start === undefined) {
        for (const entryId of entryIds) {
            targets.push(...roadTargets(state, playerId, order, undefined, entryId))
        }
    } else {
        const approaches = inReserve(start)
            ? state.map.passableApproachesOf(start.locale)
            : state.map.approachesOf(start.locale).filter((approach) => approach.id === start.approach)
        for (const approach of approaches) {
            const across = { locale: approach.neighbour }
            if (state.isEnemyOccupied(approach.neighbour, playerId)) {
                if (canAttackAcross(state, playerId, approach.id)) {
                    const position = { locale: start.locale, approach: approach.id }
                    targets.push({ key: positionKey(TargetKind.Attack, position), kind: TargetKind.Attack, position })
                }
            } else if (legal(() => validateMove(state, playerId, order, across))) {
                targets.push({ key: positionKey(TargetKind.Reserve, across), kind: TargetKind.Reserve, position: across })
            }
            const block = { locale: start.locale, approach: approach.id }
            if (inReserve(start) && legal(() => validateMove(state, playerId, order, block))) {
                targets.push({ key: positionKey(TargetKind.Approach, block), kind: TargetKind.Approach, position: block })
            }
        }
        const reserve = { locale: start.locale }
        if (!inReserve(start) && legal(() => validateMove(state, playerId, order, reserve))) {
            targets.push({ key: positionKey(TargetKind.Reserve, reserve), kind: TargetKind.Reserve, position: reserve })
        }
        if (inReserve(start)) {
            targets.push(...roadTargets(state, playerId, order, start))
        }
    }
    const unique: MoveTarget[] = []
    for (const target of targets) {
        const existing = unique.find((other) => other.kind === target.kind && samePosition(other.position, target.position))
        if (!existing) {
            unique.push(target)
        } else if (existing.road && target.road && target.road.length < existing.road.length) {
            unique.splice(unique.indexOf(existing), 1, target)
        }
    }
    return unique
}
