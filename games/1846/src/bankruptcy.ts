import { Market1846 } from './stock.js'
import { releasePrivateReservations } from './stations.js'
import * as Type from 'typebox'
import {
    CashPayment,
    PresidencyChange,
    applyPresidencyChange,
    certificatesOwnedBy,
    closePrivate,
    evaluatePresidency,
    reorderPendingOperatingCompanies,
    playersAfterPresident,
    settleCashPayments,
    sharesOwned,
    type EliminationRules
} from '@tabletop/18xx'
import { closeRailroad, corporationAwaitingClosure, RailroadClosure } from './closeCorporation.js'
import { inReceivership } from '@tabletop/18xx'
import { OperatingRules1846 } from './operating.js'
import type { HydratedEighteenFortySixState } from './state.js'

const ForcedSale = Type.Object(
    {
        companyId: Type.String(),
        certificateIds: Type.Array(Type.String()),
        shares: Type.Integer({ minimum: 1 }),
        price: Type.Integer({ minimum: 0 }),
        proceeds: Type.Integer({ minimum: 0 }),
        presidency: Type.Optional(PresidencyChange)
    },
    { additionalProperties: false }
)
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
        const forcedSales: Type.Static<typeof ForcedSale>[] = []
        const payments: CashPayment[] = []
        for (const company of state.companies) {
            if (company.kind !== 'major' || company.closed || !company.started) continue
            const shares = sharesOwned(state, company.id, player)
            if (!shares) continue
            const presidency = evaluatePresidency(
                state,
                company.id,
                playersAfterPresident(state, company.id, state.turnManager.turnOrder).filter(
                    (owner) => owner.kind !== 'player' || owner.playerId !== playerId
                ),
                { owner: player, shares: 0 }
            )
            if (presidency.change) applyPresidencyChange(state, presidency.change)
            const certificates = certificatesOwnedBy(state, player).filter(
                (certificate) => certificate.companyId === company.id
            )
            const price = Market1846.companySpace(state.stockMarket, company.id).price
            forcedSales.push({
                companyId: company.id,
                shares,
                price,
                proceeds: shares * price,
                certificateIds: certificates.map((certificate) => certificate.id),
                ...(presidency.change ? { presidency: presidency.change } : {})
            })
            if (shares * price)
                payments.push({ from: { kind: 'bank' }, to: player, amount: shares * price })
            for (const certificate of certificates) {
                certificate.owner = { kind: 'bank' }
                certificate.poolId = 'open-market'
            }
            if (company.president?.kind === 'player' && company.president.playerId === playerId)
                delete company.president
        }
        settleCashPayments(state, payments)
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
        releasePrivateReservations(state, closedPrivateIds)
        if (closedPrivateIds.includes('SC')) delete state.steamboat
        let closing = corporationAwaitingClosure(state)
        while (closing) {
            closedRailroads.push(closeRailroad(state, closing))
            closing = corporationAwaitingClosure(state)
        }
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
