import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import {
    LandscapeFill,
    Landscapes,
    type Landscape,
    type LandscapeKind,
    type TileId
} from '../data/regionTiles.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { landscapeTender } from './locationControl.js'
import type { LandscapeState } from './mapState.js'
import { ComponentCount } from './stateSchemas.js'
import { takeGoodFromHaversack, takeShillingsFromSupply, targetToMarker } from './supply.js'

/** R-1.4-H2 A landscape in play has shown its back. */
export function landscapeKindOf(state: HydratedFeudumGameState, tileId: TileId): LandscapeKind {
    const kind = state.tileLandscapes[tileId]
    assertExists(kind, `R-1.4-H2 Tile ${tileId} shows its landscape`)
    return kind
}

export function landscapeOf(state: HydratedFeudumGameState, tileId: TileId): Landscape {
    const kind = landscapeKindOf(state, tileId)
    const landscape = Landscapes.find((row) => row.kind === kind)
    assertExists(landscape, `R-4.3.4 There is a landscape ${kind}`)
    return landscape
}

function requireLandscape(state: HydratedFeudumGameState, spaceId: SpaceId): LandscapeState {
    const { landscape } = state.spaces[spaceId]
    assertExists(landscape, `R-4.3.4 ${spaceId} has a landscape`)
    return landscape
}

/**
 * R-4.3.4, R-1.1-H1 Adds up to 3 of the landscape's resource, or what remains of it. An amount
 * lying here is out of its supply until collected. Returns how many were added.
 */
export function fillLandscape(state: HydratedFeudumGameState, spaceId: SpaceId): number {
    const landscape = requireLandscape(state, spaceId)
    const { resource } = landscapeOf(state, landscape.tileId)
    const taken = takeFromSupply(state, resource, LandscapeFill)
    landscape.amount += taken
    return taken
}

function takeFromSupply(
    state: HydratedFeudumGameState,
    resource: Landscape['resource'],
    amount: number
): number {
    switch (resource) {
        case 'shillings': {
            return takeShillingsFromSupply(state, amount)
        }
        case 'targets': {
            const taken = Math.min(amount, state.supply.targets)
            state.supply.targets -= taken
            return taken
        }
        case 'food':
        case 'sulfur': {
            return takeGoodFromHaversack(state, resource, amount)
        }
    }
}

export type LandscapeCollection = Type.Static<typeof LandscapeCollection>
export const LandscapeCollection = Type.Object({
    /** R-4.3.4 What the serf kept. */
    kept: ComponentCount,
    /** R-4.3.4 What the ruler was paid: 1, or 0 if nothing lay there. */
    paid: ComponentCount,
    rulerId: Type.String(),
    /** R-4.3.4 Targets only: the markers each received; the rest of the targets are discarded. */
    seatMarkers: Type.Optional(ComponentCount),
    rulerMarkers: Type.Optional(ComponentCount)
})

/** R-4.3.4 Each target becomes a marker from the general supply, never the Knight Guild. */
function deliverTargets(state: HydratedFeudumGameState, playerId: string, targets: number): number {
    return Array.from({ length: targets }, () => targetToMarker(state, playerId)).filter(Boolean)
        .length
}

function deliver(
    state: HydratedFeudumGameState,
    playerId: string,
    resource: Landscape['resource'],
    amount: number
): void {
    const player = state.getPlayerState(playerId)
    if (resource === 'shillings') {
        player.shillings += amount
    } else if (resource !== 'targets') {
        player.goods[resource] += amount
    }
}

/** R-4.3.4 The serf takes everything lying here and pays 1 of it to the ruler. */
export function collectLandscape(
    state: HydratedFeudumGameState,
    spaceId: SpaceId
): LandscapeCollection {
    const space = state.spaces[spaceId]
    const landscape = requireLandscape(state, spaceId)
    const tender = landscapeTender(space)
    assert(tender !== undefined, `R-4.3.4 ${spaceId} has a serf to collect`)
    assertExists(space.ruler, `R-4.1.2 A serf at ${spaceId} has a ruler above`)
    const rulerId = space.ruler.playerId

    const { resource } = landscapeOf(state, landscape.tileId)
    const paid = Math.min(1, landscape.amount)
    const kept = landscape.amount - paid
    landscape.amount = 0

    if (resource === 'targets') {
        return {
            kept,
            paid,
            rulerId,
            seatMarkers: deliverTargets(state, tender, kept),
            rulerMarkers: deliverTargets(state, rulerId, paid)
        }
    }
    deliver(state, tender, resource, kept)
    deliver(state, rulerId, resource, paid)
    return { kept, paid, rulerId }
}
