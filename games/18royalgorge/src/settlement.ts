import { ActionSource, assert } from '@tabletop/common'
import {
    CashPayment,
    StockMarketMove,
    SystemActionFirstHandler,
    finiteCashOwnedBy,
    nextOperatingCompany,
    settleCashPayments,
    sharesOwned,
    systemAction,
    type FinancialState,
    type StockMarket
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { CfiId, GoldMinerId, JewelerId, VgcId } from './ids.js'
import { advanceDebtMarker } from './debt.js'
import { goldDividend } from './gold.js'
import { SteelBaseCash } from './opening.js'
import { privatePlayerHolder } from './privateHoldings.js'
import { freshSteelMarket } from './steel.js'
import {
    requireStateRoyalGorge,
    type HydratedStateRoyalGorge,
    type StateHandlerRoyalGorge
} from './state.js'
import { MarketRoyalGorge, companyMove } from './stockMarket.js'

/** What a metal company paid at the end of a set, and how its price moved (ST-8, GO-4). */
export const MetalPayout = Type.Object(
    {
        companyId: Type.String(),
        revenue: Type.Integer({ minimum: 0 }),
        perShare: Type.Integer({ minimum: 0 }),
        payments: Type.Array(CashPayment),
        marketMove: Type.Optional(StockMarketMove)
    },
    { additionalProperties: false }
)
export type MetalPayout = Type.Static<typeof MetalPayout>

const SettleOperatingRoundAction = systemAction('SettleOperatingRound', {
    metadata: Type.Optional(
        Type.Object(
            {
                /** Where the debt marker moved, once the Treaty is signed (DB-4). */
                debtSpaceId: Type.Optional(Type.String()),
                /** The set's end: the metal companies' payouts, and the jeweler's money (EG-1). */
                payouts: Type.Optional(Type.Array(MetalPayout)),
                jewelerPayment: Type.Optional(CashPayment)
            },
            { additionalProperties: false }
        )
    )
})
export const SettleOperatingRound = SettleOperatingRoundAction.schema
export type SettleOperatingRound = Type.Static<typeof SettleOperatingRound>
export const isSettleOperatingRound = SettleOperatingRoundAction.is

/** Whether the operating round has ended without its upkeep yet (End of Operating Round). */
export function settlementDue(state: object): boolean {
    const title = requireStateRoyalGorge(state)
    const set = title.operatingSet
    return (
        !!set &&
        !set.completed &&
        set.privateIncomePaid &&
        !nextOperatingCompany(title) &&
        (title.settledRound?.set !== set.number || title.settledRound.round !== set.roundNumber)
    )
}

/**
 * What a metal company pays out as the set ends: CF&I the money on its plaque, VGC the lowest
 * uncovered gold space (ST-8, GO-4).
 */
export function metalDividend(state: object, companyId: string): number {
    const title = requireStateRoyalGorge(state)
    return companyId === CfiId
        ? finiteCashOwnedBy(title, { kind: 'company', companyId })
        : goldDividend(title)
}

/** The move a payout makes: a space right for each multiple of the price, at most three (SR-7). */
export function payoutMove(
    market: StockMarket,
    companyId: string,
    revenue: number
): StockMarketMove | undefined {
    const steps = Math.min(
        3,
        Math.floor(revenue / MarketRoyalGorge.companySpace(market, companyId).price)
    )
    return steps ? companyMove(market, companyId, 'right', steps) : undefined
}

/**
 * An operating round's upkeep: the debt marker moves; after the set's last round VGC and CF&I
 * pay, the gold track clears, the steel market refills, and the jeweler's money goes to its
 * owner for the stock round (EG-1, Y6).
 */
export class HydratedSettleOperatingRound extends SettleOperatingRoundAction.Base {
    declare metadata?: SettleOperatingRound['metadata']
    apply(state: HydratedStateRoyalGorge): void {
        assert(
            this.source === ActionSource.System && settlementDue(state),
            'Only an ended operating round is settled'
        )
        const set = state.operatingSet
        assert(set, 'Settlement follows an operating round')
        const debtSpaceId = advanceDebtMarker(state)
        state.debtPaidIds = []
        state.settledRound = { set: set.number, round: set.roundNumber }
        const metadata: NonNullable<SettleOperatingRound['metadata']> = {
            ...(debtSpaceId ? { debtSpaceId } : {})
        }
        if (set.roundNumber === set.roundCount) {
            const payouts = [VgcId, CfiId].map((companyId) => {
                const payout = this.metalPayout(state, companyId)
                this.applyPayout(state, payout)
                return payout
            })
            this.resetSteelCash(state)
            state.goldShipped = 0
            state.steelMarket = freshSteelMarket()
            state.investorPurchases = []
            metadata.payouts = payouts
            // The jeweler's money becomes cash as a stock round begins: none follows the last set.
            const jeweler = privatePlayerHolder(state, JewelerId)
            const lastSet = state.gameEnding?.finalOperatingSet === set.number
            if (jeweler && state.jewelerCash && !lastSet) {
                const payment: CashPayment = {
                    from: { kind: 'bank' },
                    to: { kind: 'player', playerId: jeweler },
                    amount: state.jewelerCash
                }
                settleCashPayments(state, [payment])
                metadata.jewelerPayment = payment
            }
            state.jewelerCash = 0
        }
        this.metadata = metadata
    }
    /**
     * A metal company's dividend to its shareholders. CF&I pays out the money on its plaque and
     * keeps $50; VGC pays the lowest uncovered gold space, the bank paying, the Gold Miner's owner
     * receiving two shares' more that do not move the price (ST-8, GO-4, GO-5).
     */
    private metalPayout(state: HydratedStateRoyalGorge, companyId: string): MetalPayout {
        const steel = companyId === CfiId
        const revenue = metalDividend(state, companyId)
        const perShare = Math.floor(revenue / 10)
        const from = steel ? ({ kind: 'company', companyId } as const) : ({ kind: 'bank' } as const)
        const payments: CashPayment[] = state.players.flatMap((player) => {
            const owner = { kind: 'player' as const, playerId: player.playerId }
            const amount = sharesOwned(state, companyId, owner) * perShare
            return amount ? [{ from, to: owner, amount }] : []
        })
        const miner = steel ? undefined : privatePlayerHolder(state, GoldMinerId)
        if (miner && perShare)
            payments.push({
                from: { kind: 'bank' },
                to: { kind: 'player', playerId: miner },
                amount: perShare * 2
            })
        const marketMove = payoutMove(state.stockMarket, companyId, revenue)
        return { companyId, revenue, perShare, payments, ...(marketMove ? { marketMove } : {}) }
    }

    private applyPayout(state: HydratedStateRoyalGorge, payout: MetalPayout): void {
        settleCashPayments(state, payout.payments)
        if (payout.marketMove)
            MarketRoyalGorge.placeMarker(
                state.stockMarket,
                payout.companyId,
                payout.marketMove.toMarketSpaceId
            )
    }

    /** Sets CF&I's plaque back to $50, the rest of its money returning to the bank (ST-8). */
    private resetSteelCash(state: FinancialState): void {
        const plaque = { kind: 'company' as const, companyId: CfiId }
        const cash = finiteCashOwnedBy(state, plaque)
        if (cash > SteelBaseCash)
            settleCashPayments(state, [
                { from: plaque, to: { kind: 'bank' }, amount: cash - SteelBaseCash }
            ])
        else if (cash < SteelBaseCash)
            settleCashPayments(state, [
                { from: { kind: 'bank' }, to: plaque, amount: SteelBaseCash - cash }
            ])
    }
}

export const SettlementActions = [
    SettleOperatingRoundAction.define((action) => new HydratedSettleOperatingRound(action))
]

/** Settles each operating round before the family's exports and the next round (EG-1). */
export function settlesRounds(handler: StateHandlerRoyalGorge): StateHandlerRoyalGorge {
    return new SystemActionFirstHandler(handler, SettleOperatingRound, (state) =>
        settlementDue(state) ? {} : undefined
    )
}
