import * as Type from 'typebox'
import { Owner } from '../finance/finance.js'

export const StockRound = Type.Object(
    {
        sales: Type.Array(
            Type.Object({ owner: Owner, companyId: Type.String() }, { additionalProperties: false })
        ),
        companyPurchases: Type.Array(Type.String())
    },
    { additionalProperties: false }
)
export type StockRound = Type.Static<typeof StockRound>
