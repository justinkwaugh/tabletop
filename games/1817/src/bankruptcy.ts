import { EighteenSeventeenCharters } from './charters.js'
import { EighteenSeventeenMarket } from './stockMarket.js'
import type { EighteenSeventeenState } from './state.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { GameAction } from '@tabletop/common'
import type { CashCrisisState } from '@tabletop/18xx'
import { StockMarketMove, goBankruptSchema, presides, type CashCrisisRules } from '@tabletop/18xx'
import { isLiquidated, liquidate } from './liquidation.js'
import { EighteenSeventeenStockRules, marketSale } from './stockRules.js'
import { closeMarketShortsAgainstPool, marketPool } from './shorts.js'
import { recordFormerPresident } from './state.js'

/** What a bankruptcy liquidated, and how the market moved for it. */
export const EighteenSeventeenBankruptcyRecord = Type.Object(
    {
        liquidatedCompanyIds: Type.Array(Type.String({ minLength: 1 })),
        marketMoves: Type.Array(StockMarketMove)
    },
    { additionalProperties: false }
)
export type EighteenSeventeenBankruptcyRecord = Type.Static<
    typeof EighteenSeventeenBankruptcyRecord
>
export const EighteenSeventeenGoBankrupt = goBankruptSchema(EighteenSeventeenBankruptcyRecord)
export type EighteenSeventeenGoBankrupt = Type.Static<typeof EighteenSeventeenGoBankrupt>
const GoBankruptValidator = Compile(EighteenSeventeenGoBankrupt)
export function isEighteenSeventeenGoBankrupt(
    action: GameAction
): action is EighteenSeventeenGoBankrupt {
    return action.type === 'GoBankrupt' && GoBankruptValidator.Check(action)
}

export const EighteenSeventeenCashCrisisRules: CashCrisisRules = {
    market: EighteenSeventeenMarket,
    charters: EighteenSeventeenCharters,
    // A cash crisis arises in an operating round, when even a company that has not yet
    // operated may be sold.
    saleTerms: (state, companyId, shares) => marketSale(state, companyId, shares),
    presidencyCandidates: EighteenSeventeenStockRules.presidencyCandidates,
    afterSale: closeMarketShortsAgainstPool,
    // Every share and short goes to the market without changing a presidency, so each company
    // the player presides is liquidated without a president. The market's shorts close against
    // its shares.
    elimination: {
        schema: EighteenSeventeenBankruptcyRecord,
        eliminate(
            state: CashCrisisState & Pick<EighteenSeventeenState, 'formerPresidents'>,
            playerId
        ): EighteenSeventeenBankruptcyRecord {
            const market = marketPool(state)
            const player = { kind: 'player' as const, playerId }
            const presided = state.companies
                .filter((company) => presides(state, company.id, player))
                .map((company) => company.id)
            for (const certificate of state.certificates)
                if (
                    certificate.kind !== 'private' &&
                    certificate.owner.kind === 'player' &&
                    certificate.owner.playerId === playerId
                ) {
                    certificate.owner = { ...market.owner }
                    certificate.poolId = market.id
                }
            closeMarketShortsAgainstPool(state)
            const liquidatedCompanyIds: string[] = []
            const marketMoves: StockMarketMove[] = []
            // In operating order, which orders their arrival in the liquidation space.
            for (const companyId of EighteenSeventeenMarket.order(state.stockMarket)) {
                if (!presided.includes(companyId)) continue
                if (!isLiquidated(state.stockMarket, companyId)) {
                    marketMoves.push(liquidate(state, companyId))
                    liquidatedCompanyIds.push(companyId)
                }
                recordFormerPresident(state, companyId, playerId)
            }
            const set = state.operatingSet
            if (set && !set.completed)
                set.companyOrder = set.companyOrder.filter(
                    (companyId) =>
                        set.completedCompanyIds.includes(companyId) ||
                        companyId === state.loanStep?.companyId ||
                        !isLiquidated(state.stockMarket, companyId)
                )
            return { liquidatedCompanyIds, marketMoves }
        }
    }
}
