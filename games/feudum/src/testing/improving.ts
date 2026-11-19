import { assertExists } from '@tabletop/common'
import { Spaces, type SpaceId } from '../data/board.js'
import type { ActionCardKind } from '../data/cards.js'
import type { Good } from '../data/components.js'
import type { LocationKind } from '../data/discs.js'
import { RegionIds, type LandscapeKind, type RegionId, type TileId } from '../data/regionTiles.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { placeMarker } from '../model/locationControl.js'
import { collectTopTile } from '../model/regionStacks.js'
import { moveConcealedSeal } from '../model/seals.js'
import { tableAtPlayingCards, type Table } from './table.js'

const ImproveHand: ActionCardKind[] = ['improve', 'move', 'tax', 'guild']

/** Moves goods out of the haversack, keeping totals. */
export function giveGood(
    state: HydratedFeudumGameState,
    playerId: string,
    good: Good,
    amount = 1
): void {
    state.supply.haversack[good] -= amount
    state.getPlayerState(playerId).goods[good] += amount
}

/** R-5-H1 A seal off the pile, unseen. */
export function giveSeal(state: HydratedFeudumGameState, playerId: string): void {
    moveConcealedSeal(state, { kind: 'pile' }, { kind: 'held', playerId })
}

/** The first space on the board showing this location, or nothing. */
export function spaceOfKind(
    state: HydratedFeudumGameState,
    kind: LocationKind,
    except: readonly SpaceId[] = []
): SpaceId {
    const space = Spaces.find(
        ({ id }) => state.spaces[id].location.kind === kind && !except.includes(id)
    )
    assertExists(space, `A ${kind} is on the board`)
    return space.id
}

/** Edits the table in place, as a spec's starting position. */
export function setUp(table: Table, edit: (state: HydratedFeudumGameState) => void): void {
    table.moveTo((state) => {
        edit(state)
        return MachineState.PlayingCards
    })
}

export interface ImprovingTable {
    readonly table: Table
    readonly playerId: string
    readonly spaceId: SpaceId
    readonly region: RegionId
}

/** R-3.9.1 The seat asked holds Improve and alone rules a location of this kind. */
export function tableImproving(kind: LocationKind, cards = ImproveHand): ImprovingTable {
    const table = tableAtPlayingCards(() => ({ cards }))
    const playerId = table.asked
    const spaceId = spaceOfKind(table.hydrated(), kind)
    setUp(table, (state) => {
        placeMarker(state, playerId, spaceId)
        state.recomputeRanks()
    })
    const region = Spaces.find((space) => space.id === spaceId)?.region
    assertExists(region, 'A space lies in a region')
    return { table, playerId, spaceId, region }
}

/** R-1.4-H2 Collects a top tile whose back shows this landscape. */
export function collectTileOf(
    state: HydratedFeudumGameState,
    playerId: string,
    landscape: LandscapeKind
): TileId {
    const hidden = state.requireVault().tileLandscapes
    const stack = RegionIds.find((region) => {
        const [top] = state.regionStacks[region]
        return hidden[top] === landscape
    })
    if (!stack) {
        throw new Error(`No stack shows ${landscape}`)
    }
    return collectTopTile(state, playerId, stack).tile.id
}
