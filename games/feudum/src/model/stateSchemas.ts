import { assert } from '@tabletop/common'
import * as Type from 'typebox'
import { Spaces } from '../data/board.js'
import { ActionCardKinds } from '../data/cards.js'
import {
    Goods,
    GuildIds,
    MonsterIds,
    VesselTypes,
    type Good,
    type VesselType
} from '../data/components.js'
import { LocationDiscs } from '../data/discs.js'
import { LandscapeKinds, RegionTiles } from '../data/regionTiles.js'
import { ChickenSpaces, KnightRowIds, ScrollSpaces } from '../data/guilds.js'
import { Seals } from '../data/seals.js'
import { EpicVoyageTrack, EpochTrack, MilitaryServiceTrack } from '../data/tracks.js'
import { Mandates, RoyalWrits } from '../data/writs.js'

/** R-1.1 A number of components: never negative, never a fraction. */
export const ComponentCount = Type.Integer({ minimum: 0 })

export const GuildIdSchema = Type.Enum(GuildIds)
export const GoodSchema = Type.Enum(Goods)
export const VesselTypeSchema = Type.Enum(VesselTypes)
export const MonsterIdSchema = Type.Enum(MonsterIds)
export const ActionCardKindSchema = Type.Enum(ActionCardKinds)
export const LandscapeKindSchema = Type.Enum(LandscapeKinds)
export const SpaceIdSchema = Type.Enum(Spaces.map((space) => space.id))
export const TileIdSchema = Type.Enum(RegionTiles.map((tile) => tile.id))
export const DiscIdSchema = Type.Enum(LocationDiscs.map((disc) => disc.id))
export const SealIdSchema = Type.Enum(Seals.map((seal) => seal.id))
export const VoyageSpaceIdSchema = Type.Enum(EpicVoyageTrack.map((space) => space.id))
export const MilitarySpaceIdSchema = Type.Enum(MilitaryServiceTrack.map((space) => space.id))
export const WritIdSchema = Type.Enum(RoyalWrits.map((writ) => writ.id))
export const MandateAlternativeIdSchema = Type.Enum(
    Mandates.flatMap((mandate) =>
        mandate.kind === 'turn-in' ? mandate.alternatives.map(({ id }) => id) : []
    )
)
export const ScrollSpaceIdSchema = Type.Enum(ScrollSpaces.map((space) => space.id))
export const ChickenSpaceIdSchema = Type.Enum(ChickenSpaces.map((space) => space.id))
export const KnightRowIdSchema = Type.Enum(KnightRowIds)

/** R-2.1, R-4.11 V is never played: it is held only between its trigger and the end. */
export const SunrayIdSchema = Type.Enum(EpochTrack.map((ray) => ray.id))

/** R-1.1 A pawn is (playerId, n). */
/** R-4.10.2 How many of the sulfur an action brings the seat go in its barrel. */
export const SulfurToBarrelCount = Type.Integer({ minimum: 1 })

export const PawnNumberSchema = Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)])

export type GoodCounts = Type.Static<typeof GoodCounts>
export const GoodCounts = Type.Record(GoodSchema, ComponentCount)

export type VesselCounts = Type.Static<typeof VesselCounts>
export const VesselCounts = Type.Record(VesselTypeSchema, ComponentCount)

/** The data layer computes its ids, so they reach here as a list. */
export function recordOf<K extends string, V extends Type.TSchema>(keys: readonly K[], value: V) {
    return Type.Unsafe<Record<K, Type.Static<V>>>(Type.Record(Type.Enum([...keys]), value))
}

function hasKeys<K extends string, V>(
    record: Record<string, V>,
    keys: readonly K[]
): record is Record<string, V> & Record<K, V> {
    return keys.every((key) => Object.hasOwn(record, key))
}

export function recordFrom<K extends string, V>(
    keys: readonly K[],
    value: (key: K, index: number) => V
): Record<K, V> {
    const record = Object.fromEntries(keys.map((key, index): [K, V] => [key, value(key, index)]))
    assert(hasKeys(record, keys), 'recordFrom builds an entry for every key')
    return record
}

export function goodCounts(counts: Partial<Record<Good, number>> = {}): GoodCounts {
    return { saltpeter: 0, sulfur: 0, iron: 0, wood: 0, food: 0, ...counts }
}

export function vesselCounts(counts: Partial<Record<VesselType, number>> = {}): VesselCounts {
    return { ship: 0, submersible: 0, 'flying-machine': 0, ...counts }
}
