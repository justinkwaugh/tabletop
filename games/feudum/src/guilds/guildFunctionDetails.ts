import { Color } from '@tabletop/common'
import * as Type from 'typebox'
import { GoodCounts, GoodSchema, SealIdSchema, VesselTypeSchema } from '../model/stateSchemas.js'

/** R-4.6.1 Which of a function's two counts scored. */
export type CompletionCount = Type.Static<typeof CompletionCount>
export const CompletionCount = Type.Union([Type.Literal('rows'), Type.Literal('columns')])

/** R-4.6.3 Everything a Farmer trade sent, and where each good went. */
const FarmerTradeDetails = Type.Object({
    kind: Type.Literal('farmer-trade'),
    sent: GoodCounts,
    food: Type.Integer({ minimum: 0 }),
    shillings: Type.Integer({ minimum: 0 }),
    toBarn: GoodCounts,
    toMarket: GoodCounts,
    toCarts: GoodCounts,
    toHaversack: GoodCounts
})

/** R-4.6.4, R-4.6-H2 Both candidates, the bead drawn and where it went. */
const FarmerPullDetails = Type.Object({
    kind: Type.Literal('farmer-pull'),
    high: SealIdSchema,
    low: SealIdSchema,
    bead: SealIdSchema,
    chicken: Type.Integer({ minimum: 0 }),
    chickenSum: Type.Integer({ minimum: 0 })
})

/** R-4.6.5 The market spaces filled, and both counts. */
const FarmerPushDetails = Type.Object({
    kind: Type.Literal('farmer-push'),
    spaces: Type.Array(Type.String()),
    rows: Type.Integer({ minimum: 0 }),
    columns: Type.Integer({ minimum: 0 }),
    count: CompletionCount
})

/** R-4.6.3 Each good bought, with the space it left and its printed price, and the total. */
const MerchantTradeDetails = Type.Object({
    kind: Type.Literal('merchant-trade'),
    bought: Type.Array(
        Type.Object({
            good: GoodSchema,
            spaceId: Type.String(),
            price: Type.Integer({ minimum: 0 })
        })
    ),
    price: Type.Integer({ minimum: 0 })
})

/** R-4.6.4 The market spaces filled, and both counts: either reaches the threshold. */
const MerchantPullDetails = Type.Object({
    kind: Type.Literal('merchant-pull'),
    spaces: Type.Array(Type.String()),
    rows: Type.Integer({ minimum: 0 }),
    columns: Type.Integer({ minimum: 0 })
})

/** R-4.6.4, R-4.6.5 Each good's market and cart space, and the carts and piles it completed. */
const MarketToCartsDetails = Type.Object({
    kind: Type.Union([Type.Literal('merchant-push'), Type.Literal('alchemist-pull')]),
    moves: Type.Array(Type.Object({ from: Type.String(), to: Type.String() })),
    completed: Type.Array(GoodSchema)
})

/** R-4.6.3 The vessel is in the input. */
const AlchemistTradeDetails = Type.Object({
    kind: Type.Literal('alchemist-trade'),
    price: Type.Integer({ minimum: 0 })
})

/** R-4.6.5 A vessel, or a krud barrel priced by its place among this action's barrels. */
export type InventionChoice = Type.Static<typeof InventionChoice>
export const InventionChoice = Type.Union([VesselTypeSchema, Type.Literal('krud-barrel')])

/** R-4.6.6 What one krud barrel added to one Knight row. A dummy row has no `playerId`. */
export type RowFill = Type.Static<typeof RowFill>
export const RowFill = Type.Object({
    colour: Type.Enum(Color),
    playerId: Type.Optional(Type.String()),
    added: Type.Integer({ minimum: 1 })
})

/** R-4.6.5, R-4.6.6 The goods returned to the haversack, and each barrel's fill, in order. */
const AlchemistPushDetails = Type.Object({
    kind: Type.Literal('alchemist-push'),
    goodsUsed: GoodCounts,
    barrels: Type.Array(Type.Array(RowFill))
})

/**
 * What one guild function did, for the history sentence. Each guild function adds one member,
 * told apart by `kind`.
 */
export type GuildFunctionDetails = Type.Static<typeof GuildFunctionDetails>
export const GuildFunctionDetails = Type.Union([
    FarmerTradeDetails,
    FarmerPullDetails,
    FarmerPushDetails,
    MerchantTradeDetails,
    MerchantPullDetails,
    MarketToCartsDetails,
    AlchemistTradeDetails,
    AlchemistPushDetails
])
