import * as Type from 'typebox'
import { Owner } from '../finance/finance.js'

export const StockTurn = Type.Object(
    {
        acted: Type.Boolean(),
        bought: Type.Boolean(),
        soldBeforeBuying: Type.Boolean(),
        companiesSold: Type.Array(Type.String()),
        saleBlocks: Type.Optional(Type.Array(Type.Object({
            id: Type.String(),
            companyId: Type.String(),
            seller: Owner,
            shares: Type.Integer({ minimum: 1 }),
            price: Type.Integer({ minimum: 1 }),
            movement: Type.Integer({ minimum: 0 })
        }, { additionalProperties: false })))
    },
    { additionalProperties: false }
)
export type StockTurn = Type.Static<typeof StockTurn>
