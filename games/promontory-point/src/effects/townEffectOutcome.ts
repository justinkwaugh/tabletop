import * as Type from 'typebox'
import { MAX_PRICE_INDEX, MIN_PRICE_INDEX } from '../components/priceTrack.js'
import { TownEventKind } from '../components/townTiles.js'
import { Debtor } from '../model/pendingRepairs.js'
import { RailroadIdSchema } from '../model/schemas.js'

const PriceIndexSchema = Type.Integer({ minimum: MIN_PRICE_INDEX, maximum: MAX_PRICE_INDEX })

// R-4.2, R-1.2
export type PriceMoved = Type.Static<typeof PriceMoved>
export const PriceMoved = Type.Object({
    kind: Type.Literal(TownEventKind.PriceChange),
    railroadId: RailroadIdSchema,
    priceChange: Type.Integer(),
    priceIndexBefore: PriceIndexSchema,
    priceIndexAfter: PriceIndexSchema,
    capped: Type.Boolean()
})

export type DividendPayment = Type.Static<typeof DividendPayment>
export const DividendPayment = Type.Object({
    playerId: Type.String(),
    amount: Type.Integer({ minimum: 1 })
})

// R-4.2: every holder of the railroad, in seat order.
export type DividendPaid = Type.Static<typeof DividendPaid>
export const DividendPaid = Type.Object({
    kind: Type.Literal(TownEventKind.Dividend),
    railroadId: RailroadIdSchema,
    payments: Type.Array(DividendPayment)
})

// R-4.3-H1: a debtor pays nothing until its PayRepairs.
export type RepairsBillPayment = Type.Static<typeof RepairsBillPayment>
export const RepairsBillPayment = Type.Object({
    playerId: Type.String(),
    owed: Type.Integer({ minimum: 1 }),
    paid: Type.Integer({ minimum: 0 })
})

// R-4.2, R-4.3, R-4.3-H4: every holder billed in seat order; debtors in deciding order.
export type RepairsBilled = Type.Static<typeof RepairsBilled>
export const RepairsBilled = Type.Object({
    kind: Type.Literal(TownEventKind.Repairs),
    railroadId: RailroadIdSchema,
    bills: Type.Array(RepairsBillPayment),
    debtors: Type.Array(Debtor)
})

export type TownEffectOutcome = Type.Static<typeof TownEffectOutcome>
export const TownEffectOutcome = Type.Union([PriceMoved, DividendPaid, RepairsBilled])
