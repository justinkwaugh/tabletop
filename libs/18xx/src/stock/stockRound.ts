import * as Type from 'typebox'
import { Owner } from '../finance/finance.js'
import { StockTurn } from './stockTurn.js'

export const StockRound = Type.Object(
    {
        number: Type.Integer({ minimum: 1 }),
        completed: Type.Boolean(),
        passedPlayerIds: Type.Array(Type.String(), { uniqueItems: true }),
        turn: StockTurn,
        sales: Type.Array(
            Type.Object({ owner: Owner, companyId: Type.String() }, { additionalProperties: false })
        ),
        companyPurchases: Type.Array(Type.String())
    },
    { additionalProperties: false }
)
export type StockRound = Type.Static<typeof StockRound>

export function createStockRound(number: number): StockRound {
    return {
        number,
        completed: false,
        passedPlayerIds: [],
        turn: { acted: false, bought: false, soldBeforeBuying: false, companiesSold: [] },
        sales: [],
        companyPurchases: []
    }
}
