import * as Type from 'typebox'
import { assert } from '@tabletop/common'
import { sharesOwned, type Owner } from '../finance/finance.js'
import { StockMarketMove } from '../stock/stockMarket.js'
import {
    ShareSaleSettlement,
    evaluateShareDisposal,
    type ShareSale,
    type ShareSaleResult
} from '../stock/shareSale.js'
import type { ShareSaleTerms } from '../stock/stockRules.js'
import type { StockState } from '../stock/stockState.js'
import type { OperatingState } from '../operating/operatingSet.js'
import type { LoanState } from '../loans/loans.js'

const Id = Type.String({ minLength: 1 })
/** A player who owes the bank more than they have, and where play resumes once it is settled. */
export const CashCrisis = Type.Object(
    { playerId: Id, amount: Type.Integer({ minimum: 1 }), continuation: Id },
    { additionalProperties: false }
)
export type CashCrisis = Type.Static<typeof CashCrisis>
export const CashCrisisFields = {
    cashCrisis: Type.Optional(CashCrisis),
    bankruptPlayerIds: Type.Optional(Type.Array(Id, { minItems: 1, uniqueItems: true }))
}
export type CashCrisisState = OperatingState &
    LoanState &
    Type.Static<Type.TObject<typeof CashCrisisFields>>

export const BankruptcyRecord = Type.Object(
    {
        sales: Type.Array(ShareSaleSettlement),
        liquidatedCompanyIds: Type.Array(Id),
        marketMoves: Type.Array(StockMarketMove)
    },
    { additionalProperties: false }
)
export type BankruptcyRecord = Type.Static<typeof BankruptcyRecord>

export interface CashCrisisRules {
    /** The terms of a share sale made to raise cash; a presidency never changes hands. */
    saleTerms(
        state: StockState,
        companyId: string,
        shares: number,
        seller: Owner
    ): ShareSaleTerms | string
    /**
     * Disposes of a bankrupt player's shares and companies; the family then takes their cash,
     * forgives the debt and removes them from play.
     */
    bankrupt(state: CashCrisisState, playerId: string): BankruptcyRecord
}

export function isBankrupt(state: CashCrisisState, playerId: string): boolean {
    return !!state.bankruptPlayerIds?.includes(playerId)
}

export function evaluateCrisisSale(
    state: CashCrisisState,
    rules: CashCrisisRules,
    playerId: string,
    sale: ShareSale
): ShareSaleResult {
    const crisis = state.cashCrisis
    if (crisis?.playerId !== playerId) return { reason: 'This player has no debt to raise.' }
    const seller = { kind: 'player' as const, playerId }
    const result = evaluateShareDisposal(state, seller, [sale], {
        saleTerms: rules.saleTerms,
        presidencyCandidates: () => []
    })
    if (result.details && (sale.shares - 1) * result.details.sales[0].price >= crisis.amount)
        return { reason: 'Sell only as many shares as the debt needs.' }
    return result
}

/** Every sale the player could make now to raise cash, one per company and share count. */
export function crisisSales(
    state: CashCrisisState,
    rules: CashCrisisRules,
    playerId: string
): { sale: ShareSale; proceeds: number }[] {
    const seller = { kind: 'player' as const, playerId }
    return state.companies.flatMap((company) => {
        const owned = company.kind === 'private' ? 0 : sharesOwned(state, company.id, seller)
        return Array.from({ length: owned }, (_, index) => {
            const sale = { companyId: company.id, shares: index + 1 }
            const result = evaluateCrisisSale(state, rules, playerId, sale)
            return result.details ? [{ sale, proceeds: result.details.proceeds }] : []
        }).flat()
    })
}

export function validateCashCrisis(state: {
    machineState: string
    cashCrisis?: CashCrisis
    bankruptPlayerIds?: readonly string[]
    players: readonly { playerId: string }[]
}): void {
    assert(
        !state.cashCrisis === (state.machineState !== 'RaisingCash'),
        'A cash crisis belongs to its own state'
    )
    for (const playerId of [
        ...(state.cashCrisis ? [state.cashCrisis.playerId] : []),
        ...(state.bankruptPlayerIds ?? [])
    ])
        assert(
            state.players.some((player) => player.playerId === playerId),
            'Unknown player in debt'
        )
}
