import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction
} from '@tabletop/common'
import {
    CashPayment,
    PresidencyClaim,
    applyPresidencyClaim,
    finiteCashOwnedBy,
    markTurnPurchase,
    mustSellShares,
    stockCertificateCount,
    recordStockAction,
    sameOwner,
    settleCashPayments,
    sharesOwned
} from '@tabletop/18xx'
import { inReceivership } from './receivership.js'
import { StockRules1846, Market1846 } from './stock.js'
import type { HydratedEighteenFortySixState } from './state.js'

const ReceiverShare = Type.Object(
    {
        companyId: Type.String(),
        price: Type.Integer({ minimum: 1 }),
        claim: PresidencyClaim,
        payments: Type.Array(CashPayment)
    },
    { additionalProperties: false }
)
export type ReceiverShare = Type.Static<typeof ReceiverShare>
/** A player with 10% may buy half the market's president certificate and exchange their 10%. */
export function receiverShareChoices(
    state: HydratedEighteenFortySixState,
    playerId: string
): ReceiverShare[] {
    if (
        state.machineState !== 'StockRound' ||
        !state.activePlayerIds.includes(playerId) ||
        state.stockRound.turn.bought ||
        mustSellShares(state, playerId, StockRules1846)
    )
        return []
    const buyer = { kind: 'player' as const, playerId }
    if (
        stockCertificateCount(state, buyer, StockRules1846) >
        StockRules1846.certificateLimit(state, buyer)
    )
        return []
    return state.companies.flatMap((company) => {
        if (
            !inReceivership(state, company.id) ||
            sharesOwned(state, company.id, buyer) !== 1 ||
            state.stockRound.sales.some(
                (sale) => sale.companyId === company.id && sameOwner(sale.owner, buyer)
            )
        )
            return []
        const certificates = state.certificates.filter(
            (certificate) => certificate.companyId === company.id
        )
        if (
            certificates.some(
                (certificate) =>
                    certificate.kind === 'share' &&
                    !certificate.president &&
                    certificate.poolId === 'open-market'
            )
        )
            return []
        const president = certificates.find(
            (certificate) => certificate.kind === 'share' && certificate.president
        )
        const ordinary = certificates.find(
            (certificate) =>
                certificate.kind === 'share' &&
                !certificate.president &&
                sameOwner(certificate.owner, buyer)
        )
        assert(president && ordinary, 'A virtual purchase requires both certificates')
        const price = Market1846.companySpace(state.stockMarket, company.id).price
        if (price <= 0 || finiteCashOwnedBy(state, buyer) < price) return []
        return [
            {
                companyId: company.id,
                price,
                claim: {
                    companyId: company.id,
                    next: buyer,
                    presidentCertificateId: president.id,
                    exchangedCertificateIds: [ordinary.id],
                    poolId: 'open-market'
                },
                payments: [{ from: buyer, to: { kind: 'bank' as const }, amount: price }]
            }
        ]
    })
}
export const BuyReceiverShare = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('BuyReceiverShare'),
        source: Type.Literal(ActionSource.User),
        companyId: Type.String(),
        expectedPrice: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(ReceiverShare)
    },
    { additionalProperties: false }
)
export const BuyReceiverShareValidator = Compile(BuyReceiverShare)
export class BuyReceiverShareAction extends HydratableAction<typeof BuyReceiverShare> {
    declare playerId: string
    declare companyId: string
    declare expectedPrice: number
    declare metadata?: ReceiverShare
    constructor(data: Type.Static<typeof BuyReceiverShare>) {
        super(data, BuyReceiverShareValidator)
    }
    isValid(state: HydratedEighteenFortySixState): boolean {
        return (
            this.source === ActionSource.User &&
            receiverShareChoices(state, this.playerId).some(
                (choice) =>
                    choice.companyId === this.companyId && choice.price === this.expectedPrice
            )
        )
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(this.isValid(state), 'Invalid receiver share purchase')
        const choice = receiverShareChoices(state, this.playerId).find(
            (choice) => choice.companyId === this.companyId
        )
        assert(choice, 'Receiver purchase requires a quote')
        settleCashPayments(state, choice.payments)
        applyPresidencyClaim(state, choice.claim)
        markTurnPurchase(state)
        recordStockAction(state, this.playerId, StockRules1846.round)
        this.metadata = choice
    }
}

export function isBuyReceiverShare(
    action: GameAction
): action is Type.Static<typeof BuyReceiverShare> {
    return action.type === 'BuyReceiverShare' && BuyReceiverShareValidator.Check(action)
}
