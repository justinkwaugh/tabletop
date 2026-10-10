import {
    CommandKind,
    UnitType,
    canThreaten,
    inReserve,
    isLegal,
    resolveAttackOrders,
    resolveOrder,
    roadAttackOrder,
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

export interface MoveTarget {
    key: string
    kind: TargetKind
    position: Position
    road?: number[]
    entryId?: string
}

function target(
    kind: TargetKind,
    position: Position,
    route: Pick<MoveTarget, 'road' | 'entryId'> = {}
): MoveTarget {
    return {
        key: `${kind}:${position.locale}:${position.approach ?? 'r'}`,
        kind,
        position,
        ...route
    }
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
            targets.push(target(TargetKind.Reserve, { locale }, { road, entryId }))
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
                targets.push(target(TargetKind.Approach, position, { road, entryId }))
            }
            const rides =
                !order.continues &&
                roadAttackOrder(
                    state,
                    { attackerId: playerId, attackApproach: approach },
                    units
                ) !== undefined
            if (rides && mayThreaten(state, playerId, approach)) {
                targets.push(target(TargetKind.Attack, position, { road, entryId }))
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
                targets.push(target(TargetKind.Attack, block))
            }
        } else if (isLegal(() => validateMove(state, playerId, order, across))) {
            targets.push(target(TargetKind.Reserve, across))
        }
        if (inReserve(start) && isLegal(() => validateMove(state, playerId, order, block))) {
            targets.push(target(TargetKind.Approach, block))
        }
    }
    const reserve = { locale: start.locale }
    if (!inReserve(start) && isLegal(() => validateMove(state, playerId, order, reserve))) {
        targets.push(target(TargetKind.Reserve, reserve))
    }
    return targets
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
    const shortest: MoveTarget[] = []
    for (const candidate of targets) {
        const index = shortest.findIndex(
            (other) =>
                other.kind === candidate.kind && samePosition(other.position, candidate.position)
        )
        if (index < 0) {
            shortest.push(candidate)
        } else if ((candidate.road?.length ?? 0) < (shortest[index].road?.length ?? 0)) {
            shortest[index] = candidate
        }
    }
    return shortest
}
