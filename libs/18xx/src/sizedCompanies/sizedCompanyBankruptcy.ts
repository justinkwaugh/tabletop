import type { GameAction } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { presides } from '../finance/finance.js'
import type { CashCrisisState } from '../funding/cashCrisis.js'
import type { EliminationRules } from '../funding/elimination.js'
import { goBankruptSchema } from '../funding/goBankrupt.js'
import { StockMarketMove } from '../stock/stockMarket.js'
import type { SizedCompanyMarket } from './sizedCompanyMarket.js'
import { recordFormerPresident, type SizedCompanyRecords } from './sizedCompanyState.js'

/** What a bankruptcy liquidated, and how the market moved for it. */
export const SizedCompanyBankruptcyRecord = Type.Object(
    {
        liquidatedCompanyIds: Type.Array(Type.String({ minLength: 1 })),
        marketMoves: Type.Array(StockMarketMove)
    },
    { additionalProperties: false }
)
export type SizedCompanyBankruptcyRecord = Type.Static<typeof SizedCompanyBankruptcyRecord>

/**
 * A bankrupt player's every share and short goes to the market without changing a presidency,
 * so each company they preside is liquidated without a president, the bankrupt player recorded
 * as its former president. The market's shorts close against its shares.
 */
export function sizedCompanyElimination(
    market: SizedCompanyMarket
): EliminationRules<typeof SizedCompanyBankruptcyRecord> {
    return {
        schema: SizedCompanyBankruptcyRecord,
        eliminate(
            state: CashCrisisState & Pick<SizedCompanyRecords, 'formerPresidents'>,
            playerId: string
        ): SizedCompanyBankruptcyRecord {
            const pool = market.marketPool(state)
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
                    certificate.owner = { ...pool.owner }
                    certificate.poolId = pool.id
                }
            market.closeMarketShortsAgainstPool(state)
            const liquidatedCompanyIds: string[] = []
            const marketMoves: StockMarketMove[] = []
            // In operating order, which orders their arrival in the liquidation space.
            for (const companyId of market.chart.order(state.stockMarket)) {
                if (!presided.includes(companyId)) continue
                if (!market.isLiquidated(state.stockMarket, companyId)) {
                    marketMoves.push(market.liquidate(state, companyId))
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
                        !market.isLiquidated(state.stockMarket, companyId)
                )
            return { liquidatedCompanyIds, marketMoves }
        }
    }
}

export const SizedCompanyGoBankrupt = goBankruptSchema(SizedCompanyBankruptcyRecord)
export type SizedCompanyGoBankrupt = Type.Static<typeof SizedCompanyGoBankrupt>
const GoBankruptValidator = Compile(SizedCompanyGoBankrupt)
export function isSizedCompanyGoBankrupt(action: GameAction): action is SizedCompanyGoBankrupt {
    return action.type === 'GoBankrupt' && GoBankruptValidator.Check(action)
}
