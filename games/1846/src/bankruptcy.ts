import { Market1846 } from './stock.js'
import { releasePrivateReservations } from './stations.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameResult,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type GameAction
} from '@tabletop/common'
import {
    CashPayment,
    ShareSaleDetails,
    PresidencyChange,
    applyShareSale,
    applyPresidencyChange,
    certificatesOwnedBy,
    closePrivate,
    controllingOwner,
    evaluatePresidency,
    reorderPendingOperatingCompanies,
    finiteCashOwnedBy,
    finalWealth,
    playersAfterPresident,
    settleCashPayments,
    sharesOwned
} from '@tabletop/18xx'
import { emergencyShareSaleChoices } from './emergencyFunding.js'
import { emergencyBankOffers } from './emergencyTrain.js'
import { closeRailroad, corporationAwaitingClosure, RailroadClosure } from './closeCorporation.js'
import { inReceivership } from './receivership.js'
import { OperatingRules1846, ValuationRules1846 } from './operating.js'
import type { HydratedEighteenFortySixState } from './state.js'

export const BankruptcyFields = {
    bankruptPlayerIds: Type.Array(Type.String(), { uniqueItems: true })
}

export function bankruptcyShortfall(state: HydratedEighteenFortySixState): number | undefined {
    if (state.machineState !== 'FundingTrain' || !state.emergencyFunding) return undefined
    const companyId = state.emergencyFunding.companyId
    const owner = controllingOwner(state, companyId)
    assertExists(owner, 'Bankruptcy requires an operating president')
    const offers = emergencyBankOffers(state)
    if (!offers.length) return undefined
    const sales = emergencyShareSaleChoices(state)
    const liquidation = state.companies.reduce(
        (sum, company) =>
            sum +
            Math.max(
                0,
                ...sales
                    .filter((sale) => sale.sales[0].companyId === company.id)
                    .map((sale) => sale.proceeds)
            ),
        0
    )
    const shortfall =
        Math.min(...offers.map((offer) => offer.price)) -
        liquidation -
        finiteCashOwnedBy(state, owner) -
        finiteCashOwnedBy(state, { kind: 'company', companyId })
    return shortfall > 0 ? shortfall : undefined
}
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
export const DeclareBankruptcy = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('DeclareBankruptcy1846'),
        source: Type.Literal(ActionSource.User),
        companyId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                {
                    shortfall: Type.Integer({ minimum: 1 }),
                    sales: Type.Array(ShareSaleDetails),
                    forcedSales: Type.Array(ForcedSale),
                    payments: Type.Array(CashPayment),
                    closedRailroads: Type.Array(RailroadClosure),
                    closedPrivateIds: Type.Array(Type.String()),
                    receiverCompanyIds: Type.Array(Type.String())
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
const Validator = Compile(DeclareBankruptcy)
export function isDeclareBankruptcy1846(
    action: GameAction
): action is Type.Static<typeof DeclareBankruptcy> {
    return action.type === 'DeclareBankruptcy1846' && Validator.Check(action)
}
export class DeclareBankruptcyAction extends HydratableAction<typeof DeclareBankruptcy> {
    declare playerId: string
    declare companyId: string
    declare metadata?: Type.Static<typeof DeclareBankruptcy>['metadata']
    constructor(data: Type.Static<typeof DeclareBankruptcy>) {
        super(data, Validator)
    }
    isValid(state: HydratedEighteenFortySixState): boolean {
        return (
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            state.emergencyFunding?.companyId === this.companyId &&
            controllingOwner(state, this.companyId)?.playerId === this.playerId &&
            bankruptcyShortfall(state) !== undefined
        )
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(this.isValid(state), 'Bankruptcy requires an unavoidable train shortfall')
        const shortfall = bankruptcyShortfall(state)
        assertExists(shortfall, 'Bankruptcy requires a shortfall')
        const player = { kind: 'player' as const, playerId: this.playerId }
        const sales: ShareSaleDetails[] = []
        for (const company of state.companies) {
            const sale = emergencyShareSaleChoices(state)
                .filter((sale) => sale.sales[0].companyId === company.id)
                .toSorted((a, b) => b.proceeds - a.proceeds)[0]
            if (!sale) continue
            applyShareSale(state, sale)
            state.emergencyFunding?.soldCompanyIds.push(company.id)
            sales.push(sale)
        }
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
                    (owner) => owner.kind !== 'player' || owner.playerId !== this.playerId
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
            if (
                company.president?.kind === 'player' &&
                company.president.playerId === this.playerId
            )
                delete company.president
        }
        settleCashPayments(state, payments)
        const closedRailroads = state.companies
            .filter(
                (company) =>
                    company.kind === 'minor' &&
                    !company.closed &&
                    controllingOwner(state, company.id)?.playerId === this.playerId
            )
            .map((company) => closeRailroad(state, company.id))
        const closedPrivateIds = certificatesOwnedBy(state, player)
            .filter((certificate) => certificate.kind === 'private')
            .map((certificate) => certificate.companyId)
        for (const id of closedPrivateIds) closePrivate(state, id)
        releasePrivateReservations(state, closedPrivateIds)
        if (closedPrivateIds.includes('SC')) delete state.steamboat
        const amount = finiteCashOwnedBy(state, player)
        if (amount) {
            const payment: CashPayment = {
                from: player,
                to: { kind: 'company', companyId: this.companyId },
                amount
            }
            settleCashPayments(state, [payment])
            payments.push(payment)
        }
        let closing = corporationAwaitingClosure(state)
        while (closing) {
            closedRailroads.push(closeRailroad(state, closing))
            closing = corporationAwaitingClosure(state)
        }
        reorderPendingOperatingCompanies(state, OperatingRules1846.companyOrder(state))
        state.bankruptPlayerIds.push(this.playerId)
        state.turnManager.turnOrder = state.turnManager.turnOrder.filter(
            (id) => id !== this.playerId
        )
        state.stockRound.passedPlayerIds = state.stockRound.passedPlayerIds.filter(
            (id) => id !== this.playerId
        )
        state.priorityDealPlayerId = state.turnManager.turnOrder[0]
        state.turnManager.endTurn(state.actionCount)
        delete state.emergencyFunding
        if (state.turnManager.turnOrder.length === 1) {
            state.gameEnding = { reason: 'All other players bankrupt' }
            state.finalWealth = finalWealth(state, ValuationRules1846)
            state.winningPlayerIds = [...state.turnManager.turnOrder]
            state.result = GameResult.Win
            state.activePlayerIds = []
        } else {
            const president = controllingOwner(state, this.companyId)
            state.activePlayerIds = president
                ? [president.playerId]
                : [...state.turnManager.turnOrder]
            state.turnManager.startTurn(state.activePlayerIds[0], state.actionCount + 1)
        }
        this.metadata = {
            shortfall,
            sales,
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
