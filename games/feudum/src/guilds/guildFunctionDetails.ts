import * as Type from 'typebox'
import { GoodCounts, SealIdSchema } from '../model/stateSchemas.js'

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

/**
 * What one guild function did, for the history sentence. Each guild function adds one member,
 * told apart by `kind`.
 */
export type GuildFunctionDetails = Type.Static<typeof GuildFunctionDetails>
export const GuildFunctionDetails = Type.Union([
    FarmerTradeDetails,
    FarmerPullDetails,
    FarmerPushDetails
])
