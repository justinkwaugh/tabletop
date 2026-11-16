import { Color } from '@tabletop/common'
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
import { RingParts, type RingPart } from './ringPieces.js'
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

/** The five colours the publisher printed its cards and seat pieces in. */
export const PrintedColours = [
    Color.Red,
    Color.Blue,
    Color.Yellow,
    Color.Green,
    Color.Purple
] as const
export type PrintedColour = (typeof PrintedColours)[number]
/** A whole printed action card, frame and border in its seat colour. */
export const printedCardAsset = (kind: ActionCardKind, colour: PrintedColour) =>
    `card.action.${kind}.${colour}` as const
/** A whole printed card back in its seat colour. */
export const cardBackAsset = (colour: PrintedColour) => `card.back.${colour}` as const
/**
 * A seat's wooden pieces as printed: the hexagonal influence marker, a player disc's blank face, and
 * the face printed for a reeve's point.
 */
export const SeatPieceKinds = ['marker', 'disc', 'reeve'] as const
export type SeatPieceKind = (typeof SeatPieceKinds)[number]
export const seatPieceAsset = (kind: SeatPieceKind, colour: PrintedColour) =>
    `piece.${kind}.${colour}` as const
/** A guild's printed panel, as it lies on the board: the ground its area's state stands on. */
export const guildPanelAsset = (guild: GuildId) => `board.guild.${guild}` as const

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
/** The board's printed map, sky and bottom strip included, with the terrain and every route on it. */
export const MapAsset = 'board.map'
/**
 * The board round the map and the guild panels: the printed score ring, its corners and the frame,
 * one file for each part of it (`ringPieces.ts`).
 */
export const ringPartAsset = (part: RingPart) => `board.ring.${part}` as const

/**
 * Every publisher image the components can show, id to file. A file lives in `./supplied` as
 * `<id>.webp` or `<id>.png`. With no file a component draws its own plain labelled fallback, so
 * the tree builds and plays with none. A card or piece that takes a seat colour has an id for each
 * printed colour, shown only while the seat's displayed colour is that printed colour's own
 * (`SeatPaint`).
 */
export const AssetIds = [
    CoverAsset,
    MapAsset,
    ...RingParts.map(({ part }) => ringPartAsset(part)),
    ...GuildIds.map(guildPanelAsset),
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
    ...ActionCardKinds.flatMap((kind) =>
        PrintedColours.map((colour) => printedCardAsset(kind, colour))
    ),
    ...PrintedColours.map(cardBackAsset),
    ...SeatPieceKinds.flatMap((kind) =>
        PrintedColours.map((colour) => seatPieceAsset(kind, colour))
    ),
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

type RingPrintPart = (typeof RingParts)[number] & { readonly url: string }

/** The ring's parts, each with its file, or undefined unless the folder holds every one. */
export function ringPrint(): readonly RingPrintPart[] | undefined {
    const parts = RingParts.map((ring) => ({ ...ring, url: assetUrl(ringPartAsset(ring.part)) }))
    return parts.every((ring): ring is RingPrintPart => ring.url !== undefined) ? parts : undefined
}

/** Files in the folder that no id asks for: a crop the map doesn't know, or a misnamed one. */
export function strayFiles(files: Record<string, string>): string[] {
    const known = new Set<string>(AssetIds)
    return Object.keys(files).filter((path) => {
        const name = path.replace('./supplied/', '').replace(/\.(webp|png)$/, '')
        return !known.has(name)
    })
}
