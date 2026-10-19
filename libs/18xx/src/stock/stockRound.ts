import * as Type from 'typebox'
import { Owner, sameOwner } from '../finance/finance.js'
import { StockTurn } from './stockTurn.js'
import { StandingStockInstruction } from './stockInstruction.js'
import { assert } from '@tabletop/common'

export const StockRound = Type.Object(
    {
        number: Type.Integer({ minimum: 1 }),
        completed: Type.Boolean(),
        passedPlayerIds: Type.Array(Type.String(), { uniqueItems: true }),
        turn: StockTurn,
        sales: Type.Array(
            Type.Object({ owner: Owner, companyId: Type.String() }, { additionalProperties: false })
        ),
        companyPurchases: Type.Array(Type.String()),
        instructions: Type.Optional(Type.Array(StandingStockInstruction))
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

/** Whether the owner has sold the company's shares this stock round, which bars buying them back. */
export function soldThisStockRound(round: StockRound, owner: Owner, companyId: string): boolean {
    return round.sales.some((sale) => sameOwner(sale.owner, owner) && sale.companyId === companyId)
}

export function recordStockRoundSale(round: StockRound, owner: Owner, companyId: string): void {
    if (!soldThisStockRound(round, owner, companyId)) round.sales.push({ owner, companyId })
}

export function validateStockRound(state: {
    stockRound: StockRound
    turnManager: { turnOrder: readonly string[] }
}): void {
    assert(
        state.stockRound.passedPlayerIds.every((id) => state.turnManager.turnOrder.includes(id)),
        'Unknown passed player'
    )
}
