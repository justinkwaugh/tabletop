import type { Epoch } from './tracks.js'

/** R-1.2.1 The six regions, left to right on the board. */
export const RegionIds = ['sea', 'island', 'forest', 'desert', 'badlands', 'mountain'] as const
export type RegionId = (typeof RegionIds)[number]

/** R-4.3.1 No tile is printed for epoch V. */
export type TileEpoch = Exclude<Epoch, 5>
export const TileEpochs: readonly TileEpoch[] = [1, 2, 3, 4]

const EpochNumerals = { 1: 'i', 2: 'ii', 3: 'iii', 4: 'iv' } as const

export type TileId = `tile.${RegionId}.${(typeof EpochNumerals)[TileEpoch]}`

/**
 * R-4.3.1 A position in a region's stack. The id is permanent and names the position, not a
 * landscape: which landscape a position holds is decided at setup (R-1.4-H2).
 */
export interface RegionTile {
    readonly id: TileId
    readonly region: RegionId
    readonly epoch: TileEpoch
}

/** R-4.3.1 By region, each stack top first: epoch I on top, IV at the bottom. */
export const RegionTiles: readonly RegionTile[] = RegionIds.flatMap((region) =>
    TileEpochs.map((epoch): RegionTile => ({
        id: `tile.${region}.${EpochNumerals[epoch]}`,
        region,
        epoch
    }))
)

/** R-4.3.4 */
export const LandscapeKinds = ['orchard', 'silver-mine', 'archery-butt', 'sulfur-mine'] as const
export type LandscapeKind = (typeof LandscapeKinds)[number]

export interface Landscape {
    readonly kind: LandscapeKind
    readonly resource: 'food' | 'shillings' | 'targets' | 'sulfur'
}

/** R-4.3.4 */
export const Landscapes: readonly Landscape[] = [
    { kind: 'orchard', resource: 'food' },
    { kind: 'silver-mine', resource: 'shillings' },
    { kind: 'archery-butt', resource: 'targets' },
    { kind: 'sulfur-mine', resource: 'sulfur' }
]

/** R-4.3.4 What a landscape gains when placed and at each epoch dawn. */
export const LandscapeFill = 3

/** R-1.4-H2 The six landscapes printed on each epoch's tile backs, shuffled across the stacks at setup. */
export const EpochLandscapes: Readonly<Record<TileEpoch, readonly LandscapeKind[]>> = {
    1: ['orchard', 'orchard', 'silver-mine', 'silver-mine', 'sulfur-mine', 'archery-butt'],
    2: ['orchard', 'silver-mine', 'sulfur-mine', 'sulfur-mine', 'archery-butt', 'archery-butt'],
    3: ['orchard', 'orchard', 'silver-mine', 'silver-mine', 'sulfur-mine', 'archery-butt'],
    4: ['orchard', 'silver-mine', 'sulfur-mine', 'sulfur-mine', 'archery-butt', 'archery-butt']
}

/** R-4.11.1 Six faces, one per region. A roll picks by index, so this order is permanent. */
export const ProgressDieFaces: readonly RegionId[] = RegionIds
