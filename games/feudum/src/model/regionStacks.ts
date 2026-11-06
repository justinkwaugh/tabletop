import { assertExists } from '@tabletop/common'
import {
    RegionIds,
    RegionTiles,
    type RegionId,
    type RegionTile,
    type TileId
} from '../data/regionTiles.js'
import { RegionTileChart, type Epoch } from '../data/tracks.js'
import type { HydratedFeudumGameState } from './gameState.js'

const TilesById: ReadonlyMap<TileId, RegionTile> = new Map(
    RegionTiles.map((tile) => [tile.id, tile])
)

export function tileById(tileId: TileId): RegionTile {
    const tile = TilesById.get(tileId)
    assertExists(tile, `R-4.3.1 No tile ${tileId}`)
    return tile
}

/** R-4.3.1 Undefined: the stack is empty and shows its printed V. */
export function stackTop(state: HydratedFeudumGameState, region: RegionId): RegionTile | undefined {
    const tileId = state.regionStacks[region].at(0)
    return tileId === undefined ? undefined : tileById(tileId)
}

/** R-4.3.1 The current epoch or earlier; anything later is prohibited. */
export function isTileLegal(epoch: Epoch, tile: RegionTile): boolean {
    return tile.epoch <= epoch
}

/** R-4.11.1 The regions whose top tile the progress die could remove. */
export function legalStackRegions(state: HydratedFeudumGameState): RegionId[] {
    return RegionIds.filter((region) => {
        const top = stackTop(state, region)
        return top !== undefined && isTileLegal(state.epoch, top)
    })
}

/** R-1.4-H2 A tile on offer and the stack it tops: the tiles are shuffled across the stacks. */
export interface StackTile {
    readonly stack: RegionId
    readonly tile: RegionTile
}

/** R-4.3.2, R-4.3-H1 Other stacks' tops earlier than the current epoch; none in epoch I. */
export function earlierTileCandidates(
    state: HydratedFeudumGameState,
    region: RegionId
): StackTile[] {
    return RegionIds.filter((other) => other !== region).flatMap((other) => {
        const top = stackTop(state, other)
        return top !== undefined && top.epoch < state.epoch ? [{ stack: other, tile: top }] : []
    })
}

/** R-4.3.2 A legal tile scores; a prohibited one leaves a choice of earlier tiles, perhaps none. */
export type ImprovementTile =
    | { readonly kind: 'legal'; readonly tile: RegionTile }
    | { readonly kind: 'prohibited'; readonly candidates: readonly StackTile[] }

/** R-4.3.2, R-4.3-H1 What an improvement in this region offers. */
export function improvementTile(state: HydratedFeudumGameState, region: RegionId): ImprovementTile {
    const top = stackTop(state, region)
    if (top !== undefined && isTileLegal(state.epoch, top)) {
        return { kind: 'legal', tile: top }
    }
    return { kind: 'prohibited', candidates: earlierTileCandidates(state, region) }
}

/** R-4.3.2 The chart's vp for a legal tile and the location improved to. */
export function tileVp(tile: RegionTile, location: 'farm' | 'town' | 'feudum'): number {
    const row = RegionTileChart.find((chartRow) => chartRow.tileEpoch === tile.epoch)
    assertExists(row?.vp, `R-4.3.2 The chart scores no tile of epoch ${tile.epoch}`)
    return row.vp[location]
}
