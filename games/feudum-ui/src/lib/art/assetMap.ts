import {
    ActionCardKinds,
    GuildIds,
    Goods,
    LandscapeKinds,
    MonsterIds,
    RoyalWrits,
    TileEpochs,
    VesselTypes,
    type ActionCardKind,
    type BeadValue,
    type Good,
    type GuildId,
    type LandscapeKind,
    type LocationKind,
    type MonsterId,
    type TileEpoch,
    type VesselType,
    type WritId
} from '@tabletop/feudum'
import { suppliedFiles } from './suppliedFiles.js'

const EpochNumerals = { 1: 'i', 2: 'ii', 3: 'iii', 4: 'iv' } as const

export const BeadValues: readonly BeadValue[] = [2, 3, 4, 5]
export const ShillingValues = [1, 5] as const
export type ShillingValue = (typeof ShillingValues)[number]

export const goodAsset = (good: Good) => `good.${good}` as const
export const vesselAsset = (vessel: VesselType) => `vessel.${vessel}` as const
export const monsterAsset = (monster: MonsterId) => `monster.${monster}` as const
export const shillingAsset = (value: ShillingValue) => `shilling.${value}` as const
export const beadAsset = (value: BeadValue) => `bead.${value}` as const
export const tileFrontAsset = (epoch: TileEpoch) => `tile.front.${EpochNumerals[epoch]}` as const
export const tileBackAsset = (landscape: LandscapeKind) => `tile.back.${landscape}` as const
export const cardAsset = (kind: ActionCardKind) => `card.action.${kind}` as const

/** A feudum's disc is told by its guild's icon; the other kinds have one face each. */
export function locationAsset(kind: LocationKind, guild?: GuildId) {
    return kind === 'feudum'
        ? (`location.feudum.${guild ?? 'farmer'}` as const)
        : (`location.${kind}` as const)
}

export const SealAsset = 'seal'
export const TargetAsset = 'target.archery'
export const WritBackAsset = 'writ.back'
export const CoverAsset = 'cover'

/**
 * Every publisher image the components can show, id to file. A file lives in `./supplied` as
 * `<id>.webp` or `<id>.png`. With no file a component draws its own plain labelled fallback, so
 * the tree builds and plays with none. A piece or frame that takes a seat colour has no id here.
 */
export const AssetIds = [
    CoverAsset,
    SealAsset,
    TargetAsset,
    WritBackAsset,
    ...Goods.map(goodAsset),
    ...VesselTypes.map(vesselAsset),
    ...MonsterIds.map(monsterAsset),
    ...ShillingValues.map(shillingAsset),
    ...BeadValues.map(beadAsset),
    ...TileEpochs.map(tileFrontAsset),
    ...LandscapeKinds.map(tileBackAsset),
    ...ActionCardKinds.map(cardAsset),
    locationAsset('outpost'),
    locationAsset('farm'),
    locationAsset('town'),
    ...GuildIds.map((guild) => locationAsset('feudum', guild)),
    ...RoyalWrits.map(({ id }): WritId => id)
] as const

export type AssetId = (typeof AssetIds)[number]

/** Paths are relative to this folder, so the record's keys read `./supplied/<id>.<ext>`. */
export function assetUrlIn(files: Record<string, string>, id: string): string | undefined {
    return files[`./supplied/${id}.webp`] ?? files[`./supplied/${id}.png`]
}

/** The file for an id, or undefined when the folder doesn't hold it. */
export function assetUrl(id: AssetId): string | undefined {
    return assetUrlIn(suppliedFiles, id)
}

/** Files in the folder that no id asks for: a crop the map doesn't know, or a misnamed one. */
export function strayFiles(files: Record<string, string>): string[] {
    const known = new Set<string>(AssetIds)
    return Object.keys(files).filter((path) => {
        const name = path.replace('./supplied/', '').replace(/\.(webp|png)$/, '')
        return !known.has(name)
    })
}
