import { Routes, type Route, type RouteMedium, type SpaceId } from '../data/board.js'
import {
    MonsterIds,
    Monsters,
    VesselTypes,
    type MonsterId,
    type VesselType
} from '../data/components.js'
import type { HydratedFeudumGameState } from './gameState.js'
import type { PawnState } from './playerState.js'

/** R-4.2.3 Per one-way trip, to the general supply. */
export const FerryFare = 2

const RoutesBySpace: ReadonlyMap<SpaceId, readonly Route[]> = Routes.reduce((bySpace, route) => {
    bySpace.set(route.a, [...(bySpace.get(route.a) ?? []), route])
    bySpace.set(route.b, [...(bySpace.get(route.b) ?? []), route])
    return bySpace
}, new Map<SpaceId, Route[]>())

/** R-1.2.2 Every route touching a space, in `Routes` order. */
export function routesAt(spaceId: SpaceId): readonly Route[] {
    return RoutesBySpace.get(spaceId) ?? []
}

/** R-1.2-H1 Routes are undirected. */
export function routeEnd(route: Route, from: SpaceId): SpaceId {
    return route.a === from ? route.b : route.a
}

/** R-1.2-H1 */
export function routeBetween(from: SpaceId, to: SpaceId, medium: RouteMedium): Route | undefined {
    return routesAt(from).find((route) => route.medium === medium && routeEnd(route, from) === to)
}

/** One step a piece may take. `vessel` names a vessel it must take up to go; none: it needs none, or is aboard. */
export interface RouteStep {
    readonly route: Route
    readonly to: SpaceId
    /** R-4.2.2 Board one abandoned on the space, or place one from the personal supply. */
    readonly vessel?: 'board' | 'place'
    /** R-4.2.3 The step costs `FerryFare`. */
    readonly ferry?: true
}

/** R-4.2.3 */
export function ferriesOpen(state: HydratedFeudumGameState): boolean {
    return state.guilds.alchemist.vesselsForSale.length === 0
}

/** R-4.2.4 Monsters on the space controlled by someone else. */
export function pinningMonsters(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId
): MonsterId[] {
    return MonsterIds.filter((monster) => {
        const { playerId: controller, spaceId: standsOn } = state.monsters[monster]
        return standsOn === spaceId && controller !== playerId
    })
}

function pawnOf(
    state: HydratedFeudumGameState,
    playerId: string,
    n: PawnState['n']
): PawnState | undefined {
    return state.getPlayerState(playerId).pawns.find((pawn) => pawn.n === n)
}

/** R-4.2.4 It can only migrate off, conquer the monster, or wait for it to leave. */
export function isPinned(
    state: HydratedFeudumGameState,
    playerId: string,
    n: PawnState['n']
): boolean {
    const spaceId = pawnOf(state, playerId, n)?.spaceId
    return spaceId !== undefined && pinningMonsters(state, playerId, spaceId).length > 0
}

/** R-4.2.2 The vessel a route's medium needs; none by road or ferry. */
export function vesselOfMedium(medium: RouteMedium): VesselType | undefined {
    return VesselTypes.find((vessel) => vessel === medium)
}

/**
 * R-4.2.1 to R-4.2.4 The ways this pawn may take this route from where it stands. None if pinned,
 * off the board or elsewhere. Boarding and placing are both listed when both are possible.
 */
export function pawnRouteOptions(
    state: HydratedFeudumGameState,
    playerId: string,
    n: PawnState['n'],
    route: Route
): RouteStep[] {
    const pawn = pawnOf(state, playerId, n)
    const from = pawn?.spaceId
    if (
        pawn === undefined ||
        from === undefined ||
        (route.a !== from && route.b !== from) ||
        isPinned(state, playerId, n)
    ) {
        return []
    }
    const to = routeEnd(route, from)
    const player = state.getPlayerState(playerId)
    if (route.medium === 'road') {
        return [{ route, to }]
    }
    if (route.medium === 'ferry') {
        return ferriesOpen(state) && player.shillings >= FerryFare
            ? [{ route, to, ferry: true }]
            : []
    }
    const vessel = vesselOfMedium(route.medium)
    if (vessel === undefined) {
        return []
    }
    if (pawn.vessel === vessel) {
        return [{ route, to }]
    }
    const options: RouteStep[] = []
    if (state.spaces[from].vessels[vessel] > 0) {
        options.push({ route, to, vessel: 'board' })
    }
    if (player.vessels[vessel] > 0) {
        options.push({ route, to, vessel: 'place' })
    }
    return options
}

/** R-3.7.1, R-4.2 Every step this pawn may take now. */
export function pawnSteps(
    state: HydratedFeudumGameState,
    playerId: string,
    n: PawnState['n']
): RouteStep[] {
    const spaceId = pawnOf(state, playerId, n)?.spaceId
    return spaceId === undefined
        ? []
        : routesAt(spaceId).flatMap((route) => pawnRouteOptions(state, playerId, n, route))
}

/** R-4.2.4 The behemoth by road and flying machine, the sea serpent by ship and submersible. */
export function monsterMayUse(monster: MonsterId, route: Route): boolean {
    return Monsters.some(
        (row) => row.monster === monster && row.media.some((medium) => medium === route.medium)
    )
}

/** R-3.7.1, R-4.2.4 Every step this monster may take now. */
export function monsterSteps(state: HydratedFeudumGameState, monster: MonsterId): RouteStep[] {
    const spaceId = state.monsters[monster].spaceId
    if (spaceId === undefined) {
        return []
    }
    return routesAt(spaceId)
        .filter((route) => monsterMayUse(monster, route))
        .map((route) => ({ route, to: routeEnd(route, spaceId) }))
}

/** R-4.6.3 Whether a tamed monster can deploy here: a route it may use touches the space. */
export function monsterReaches(monster: MonsterId, spaceId: SpaceId): boolean {
    return routesAt(spaceId).some((route) => monsterMayUse(monster, route))
}
