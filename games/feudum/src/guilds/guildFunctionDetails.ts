import * as Type from 'typebox'
import { KnightRowOwner } from '../model/guildsState.js'
import {
    ChickenSpaceIdSchema,
    GoodCounts,
    GoodSchema,
    KnightRowIdSchema,
    SealIdSchema,
    VesselTypeSchema
} from '../model/stateSchemas.js'

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
    chicken: ChickenSpaceIdSchema,
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

/** R-4.6.6 What one krud barrel added to one Knight row, and whose row it is. */
export type RowFill = Type.Static<typeof RowFill>
export const RowFill = Type.Object({
    rowId: KnightRowIdSchema,
    owner: KnightRowOwner,
    added: Type.Integer({ minimum: 1 })
})

/** R-4.6.4, R-4.6.5, R-4.6.6 The goods returned to the haversack, and each barrel's fill, in order. */
const InventionsDetails = Type.Object({
    kind: Type.Union([Type.Literal('alchemist-push'), Type.Literal('knight-pull')]),
    goodsUsed: GoodCounts,
    barrels: Type.Array(Type.Array(RowFill))
})

/** R-4.6.3 The row's markers taken and those kept; the monster and its space are in the input. */
const KnightTradeDetails = Type.Object({
    kind: Type.Literal('knight-trade'),
    taken: Type.Integer({ minimum: 0 }),
    kept: Type.Integer({ minimum: 0 }),
    price: Type.Integer({ minimum: 0 })
})

/** R-4.6.4, R-4.6.5 A row a marker left, and whose it is. */
export type KnightRowLeft = Type.Static<typeof KnightRowLeft>
export const KnightRowLeft = Type.Object({
    rowId: KnightRowIdSchema,
    owner: KnightRowOwner
})

/** R-4.6.5 The rows the markers left and both counts. The seals are named in no record (R-X.2). */
const KnightPushDetails = Type.Object({
    kind: Type.Literal('knight-push'),
    markers: Type.Array(KnightRowLeft),
    rows: Type.Integer({ minimum: 0 }),
    columns: Type.Integer({ minimum: 0 }),
    count: CompletionCount
})

/** R-4.6-H1 The scroll spaces are in the input; the seals bought stay concealed. */
const NobleTradeDetails = Type.Object({
    kind: Type.Literal('noble-trade'),
    price: Type.Integer({ minimum: 0 })
})

/** R-4.6.4 As the Knight push, without a choice of count: either reaches the threshold. */
const NoblePullDetails = Type.Object({
    kind: Type.Literal('noble-pull'),
    markers: Type.Array(KnightRowLeft),
    rows: Type.Integer({ minimum: 0 }),
    columns: Type.Integer({ minimum: 0 })
})

/** R-4.6.5 The seals flipped, in input order, and the rosary's total after them. */
const NoblePushDetails = Type.Object({
    kind: Type.Literal('noble-push'),
    sealIds: Type.Array(SealIdSchema),
    rosaryTotal: Type.Integer({ minimum: 0 })
})

/** R-4.6.3, R-4.6-H2 Both candidates and the bead kept; the other stays on the rosary. */
const MonkTradeDetails = Type.Object({
    kind: Type.Literal('monk-trade'),
    high: SealIdSchema,
    low: SealIdSchema,
    bead: SealIdSchema,
    price: Type.Integer({ minimum: 0 })
})

/** R-4.6.4 The seal flipped, and the rosary's total after it. */
const MonkPullDetails = Type.Object({
    kind: Type.Literal('monk-pull'),
    sealIds: Type.Array(SealIdSchema),
    rosaryTotal: Type.Integer({ minimum: 0 })
})

/** R-4.6.5, R-4.6-H2 Both candidates, the bead drawn and where it went. */
const MonkPushDetails = Type.Object({
    kind: Type.Literal('monk-push'),
    high: SealIdSchema,
    low: SealIdSchema,
    bead: SealIdSchema,
    chicken: ChickenSpaceIdSchema,
    chickenSum: Type.Integer({ minimum: 0 })
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
    InventionsDetails,
    KnightTradeDetails,
    KnightPushDetails,
    NobleTradeDetails,
    NoblePullDetails,
    NoblePushDetails,
    MonkTradeDetails,
    MonkPullDetails,
    MonkPushDetails
])
