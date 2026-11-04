import { Market1846 } from './stock.js'
import * as Type from 'typebox'
import {
    CashPayment,
    ForcedSale,
    certificatesOwnedBy,
    closePrivate,
    closeZeroPriceCorporations,
    reorderPendingOperatingCompanies,
    sellBankruptHoldings,
    type EliminationRules
} from '@tabletop/18xx'
import { closeRailroad, RailroadClosure } from './closeCorporation.js'
import { inReceivership } from '@tabletop/18xx'
import { OperatingRules1846 } from './operating.js'
import type { HydratedEighteenFortySixState } from './state.js'

export const BankruptcyChanges1846 = Type.Object(
    {
        forcedSales: Type.Array(ForcedSale),
        payments: Type.Array(CashPayment),
        closedRailroads: Type.Array(RailroadClosure),
        closedPrivateIds: Type.Array(Type.String()),
        receiverCompanyIds: Type.Array(Type.String())
    },
    { additionalProperties: false }
)
export type BankruptcyChanges1846 = Type.Static<typeof BankruptcyChanges1846>

/**
 * GMT §7: a bankrupt president's remaining stock is sold to the market at its price, without
 * moving it, even above the market limit; presidencies pass to the largest holders or leave
 * the corporation in receivership; their independents and privates close.
 */
export const Elimination1846: EliminationRules<typeof BankruptcyChanges1846> = {
    schema: BankruptcyChanges1846,
    eliminate(state: HydratedEighteenFortySixState, playerId): BankruptcyChanges1846 {
        const player = { kind: 'player' as const, playerId }
        const { forcedSales, payments } = sellBankruptHoldings(
            { market: Market1846, marketPoolId: 'open-market' },
            state,
            playerId
        )
        const closedRailroads = state.companies
            .filter(
                (company) =>
                    company.kind === 'minor' &&
                    !company.closed &&
                    company.president?.kind === 'player' &&
                    company.president.playerId === playerId
            )
            .map((company) => closeRailroad(state, company.id))
        const closedPrivateIds = certificatesOwnedBy(state, player)
            .filter((certificate) => certificate.kind === 'private')
            .map((certificate) => certificate.companyId)
        for (const id of closedPrivateIds) closePrivate(state, id)
        if (closedPrivateIds.includes('SC')) delete state.steamboat
        closedRailroads.push(
            ...closeZeroPriceCorporations(state, Market1846, (companyId) =>
                closeRailroad(state, companyId)
            )
        )
        reorderPendingOperatingCompanies(state, OperatingRules1846.companyOrder(state))
        return {
            forcedSales,
            payments,
            closedRailroads,
            closedPrivateIds,
            receiverCompanyIds: state.companies
                .filter((company) => inReceivership(state, company.id))
                .map((company) => company.id)
        }
    }
}
