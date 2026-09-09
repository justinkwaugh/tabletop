import * as Type from 'typebox'
import { Owner } from '../finance/finance.js'
import { StockTurn } from './stockTurn.js'

export const StockRound = Type.Object(
    {
        number: Type.Integer({ minimum: 1 }),
        turn: StockTurn,
        sales: Type.Array(
            Type.Object({ owner: Owner, companyId: Type.String() }, { additionalProperties: false })
        ),
        companyPurchases: Type.Array(Type.String())
    },
    { additionalProperties: false }
)
export type StockRound = Type.Static<typeof StockRound>
