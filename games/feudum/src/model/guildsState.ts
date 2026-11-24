import * as Type from 'typebox'
import {
    AlchemistCartSpaces,
    ChickenSpaces,
    KnightSections,
    type KnightRowId,
    MarketSpaces,
    ScrollSpaces
} from '../data/guilds.js'
import {
    ComponentCount,
    GoodCounts,
    GuildIdSchema,
    KnightRowIdSchema,
    recordOf,
    SealIdSchema,
    VesselTypeSchema
} from './stateSchemas.js'
import type { SealId } from '../data/seals.js'

/** R-4.5.2 A marker on a rank; R-4.7 the reeve follows it. */
export type RankHolder = Type.Static<typeof RankHolder>
export const RankHolder = Type.Object({
    playerId: Type.String(),
    reeve: Type.Boolean()
})

/** R-4.5.3 The apprentice space is used only at 4 and 5 players. */
export type GuildTrack = Type.Static<typeof GuildTrack>
export const GuildTrack = Type.Object({
    master: Type.Optional(RankHolder),
    journeyman: Type.Optional(RankHolder),
    apprentice: Type.Optional(RankHolder)
})

/** R-1.4-H1 Whose row it is: a seat's, by its playerId, or no seat's; the row's id names a dummy. */
export type KnightRowOwner = Type.Static<typeof KnightRowOwner>
export const KnightRowOwner = Type.Union([
    Type.Object({ playerId: Type.String() }, { additionalProperties: false }),
    Type.Object({ dummy: Type.Literal(true) }, { additionalProperties: false })
])

/** R-1.3 A Knight row: its owner and how many markers stand in it. */
export type KnightRow = Type.Static<typeof KnightRow>
export const KnightRow = Type.Object({
    owner: KnightRowOwner,
    markers: Type.Integer({
        minimum: 0,
        maximum: KnightSections.reduce((sum, section) => sum + section.spaces, 0)
    })
})

const ChickenSchema = Type.Union([SealIdSchema, Type.Null()])

export type GuildsState = Type.Static<typeof GuildsState>
export const GuildsState = Type.Object({
    /** R-4.5.2 A marker here is membership. */
    tracks: Type.Record(GuildIdSchema, GuildTrack),
    farmer: Type.Object({
        barn: GoodCounts,
        /** R-1.3 By chicken space: a bead or nothing. */
        chickens: recordOf(
            ChickenSpaces.map((space) => space.id),
            ChickenSchema
        ),
        purse: ComponentCount
    }),
    merchant: Type.Object({
        /** R-1.3 A space holds its bin's good or nothing. */
        market: recordOf(
            MarketSpaces.map((space) => space.id),
            Type.Boolean()
        )
    }),
    alchemist: Type.Object({
        carts: recordOf(
            AlchemistCartSpaces.map((space) => space.id),
            Type.Boolean()
        ),
        vesselsForSale: Type.Array(VesselTypeSchema)
    }),
    knight: Type.Object({
        /** R-1.3, R-1.4-H1, R-4.2.4 By row id; a monster's controller lies on the monster. */
        rows: Type.Unsafe<Partial<Record<KnightRowId, KnightRow>>>(
            Type.Partial(Type.Record(KnightRowIdSchema, KnightRow), { additionalProperties: false })
        )
    }),
    noble: Type.Object({
        /** R-5-H1 True: a concealed seal lies there, its id in the vault. */
        scrolls: recordOf(
            ScrollSpaces.map((space) => space.id),
            Type.Boolean()
        )
    }),
    monk: Type.Object({
        /** R-4.6.5 Beads, public. */
        rosary: Type.Array(SealIdSchema),
        coffer: ComponentCount
    })
})

/** R-1.3 */
export function chickenBeads(farmer: GuildsState['farmer']): SealId[] {
    return ChickenSpaces.flatMap(({ id }) => {
        const bead = farmer.chickens[id]
        return bead === null ? [] : [bead]
    })
}
