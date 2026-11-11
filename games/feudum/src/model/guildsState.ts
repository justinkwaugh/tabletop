import { Color } from '@tabletop/common'
import * as Type from 'typebox'
import { MonsterIds } from '../data/components.js'
import {
    AlchemistCartSpaces,
    ChickenSpaces,
    KnightSections,
    MarketSpaces,
    ScrollSpaces
} from '../data/guilds.js'
import {
    ComponentCount,
    GoodCounts,
    GuildIdSchema,
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

/** R-1.4-H1 A player row names its playerId; a dummy row is keyed by its colour alone. */
export type KnightRow = Type.Static<typeof KnightRow>
export const KnightRow = Type.Object({
    colour: Type.Enum(Color),
    playerId: Type.Optional(Type.String()),
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
        rows: Type.Array(KnightRow),
        /** R-4.2.4 The marker of the player controlling each monster. */
        monsterIcons: Type.Record(Type.Enum(MonsterIds), Type.Union([Type.String(), Type.Null()]))
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

/** R-1.3 The beads on the chickens, in space order. */
export function chickenBeads(farmer: GuildsState['farmer']): SealId[] {
    return ChickenSpaces.flatMap(({ id }) => {
        const bead = farmer.chickens[id]
        return bead === null ? [] : [bead]
    })
}
