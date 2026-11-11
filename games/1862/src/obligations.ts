import {
    SystemActionFirstHandler,
    applyShareSale,
    certificatesOwnedBy,
    evaluateShareDisposal,
    finiteCashOwnedBy,
    getCompany,
    settleCashPayments,
    sharesOwned,
    ShareSaleDetails,
    type EighteenXXStateHandler
} from '@tabletop/18xx'
import {
    ActionSource,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import * as Type from 'typebox'
import { resetCompany1862 } from './companyReset.js'
import { PayingFineState, type HydratedState1862 } from './state.js'
import { StockRules1862, marketSale, saleValue } from './stockRules.js'
import { systemAction, titleAction } from './titleAction.js'

/** The fine for a charter not floated: five times its par (§4.3). */
export const FineMultiple = 5

/** Obligations falling due as the stock round that had to float them ends (§4.3). */
export function dueObligations(state: HydratedState1862) {
    return state.stockRound.completed
        ? state.obligations.filter((entry) => entry.stockRound <= state.stockRound.number)
        : []
}

const player = (playerId: string) => ({ kind: 'player' as const, playerId })

const Fine = Type.Object(
    {
        companyId: Type.String(),
        playerId: Type.String(),
        fine: Type.Integer({ minimum: 0 }),
        paidInCash: Type.Integer({ minimum: 0 }),
        sharesSold: Type.Integer({ minimum: 0 }),
        owed: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)

const EnforceAction = systemAction('EnforceObligations', {
    metadata: Type.Optional(
        Type.Object({ fines: Type.Array(Fine) }, { additionalProperties: false })
    )
})
export const EnforceObligations = EnforceAction.schema
export const isEnforceObligations = EnforceAction.is

/**
 * Fines each holder of an unfloated charter five times its par: from cash, then by selling their
 * shares in it, and what remains from their other shares. The company returns to the IPO with
 * all its shares, startable again from the next stock round (§4.3).
 */
export class HydratedEnforceObligations extends EnforceAction.Base {
    declare metadata?: Type.Static<typeof EnforceObligations>['metadata']
    apply(state: HydratedState1862): void {
        const due = dueObligations(state)
        assert(this.source === ActionSource.System && due.length > 0, 'Obligations are due')
        const fines: Type.Static<typeof Fine>[] = []
        for (const obligation of due) {
            const company = getCompany(state, obligation.companyId)
            assertExists(company.parPrice, 'A chartered company has a par')
            const fine = FineMultiple * company.parPrice
            const payer = player(obligation.playerId)
            const paidInCash = Math.min(fine, finiteCashOwnedBy(state, payer))
            // Only as many of the company's shares as the rest of the fine needs are sold; the
            // others go back to the IPO with the company, without compensation.
            const held = sharesOwned(state, obligation.companyId, payer)
            const value = saleValue(state, obligation.companyId)
            const short = fine - paidInCash
            const shares = value > 0 ? Math.min(held, Math.ceil(short / value)) : 0
            const proceeds = shares * value
            const fromShares = Math.min(short, proceeds)
            settleCashPayments(state, [
                ...(proceeds
                    ? [{ from: { kind: 'bank' as const }, to: payer, amount: proceeds }]
                    : []),
                ...(paidInCash + fromShares
                    ? [
                          {
                              from: payer,
                              to: { kind: 'bank' as const },
                              amount: paidInCash + fromShares
                          }
                      ]
                    : [])
            ])
            const owed = fine - paidInCash - fromShares
            fines.push({ ...obligation, fine, paidInCash, sharesSold: shares, owed })
            if (owed)
                state.fines = [
                    ...(state.fines ?? []),
                    { playerId: obligation.playerId, amount: owed }
                ]
            resetCompany1862(state, obligation.companyId)
            state.resetCompanyIds = [
                ...(state.resetCompanyIds ?? []).filter((id) => id !== obligation.companyId),
                obligation.companyId
            ]
        }
        this.metadata = { fines }
    }
}

/** What the fined player could sell now, toward the fine. */
export function fineSale(
    state: HydratedState1862,
    playerId: string,
    companyId: string,
    shares: number
) {
    const fine = state.fines?.[0]
    if (fine?.playerId !== playerId) return { reason: 'This player owes no fine.' }
    const result = evaluateShareDisposal(state, player(playerId), [{ companyId, shares }], {
        ...StockRules1862,
        saleTerms: marketSale
    })
    if (!result.details) return result
    if ((shares - 1) * result.details.sales[0].price >= fine.amount)
        return { reason: 'Sell only as many shares as the fine needs.' }
    return result
}

export function fineSales(state: HydratedState1862, playerId: string) {
    const holdings = new Set(
        certificatesOwnedBy(state, player(playerId)).map((certificate) => certificate.companyId)
    )
    return [...holdings].flatMap((companyId) =>
        Array.from({ length: sharesOwned(state, companyId, player(playerId)) }, (_, index) => {
            const result = fineSale(state, playerId, companyId, index + 1)
            return result.details
                ? [{ companyId, shares: index + 1, proceeds: result.details.proceeds }]
                : []
        }).flat()
    )
}

const SellAction = titleAction('SellForFine', {
    companyId: Type.String({ minLength: 1 }),
    shares: Type.Integer({ minimum: 1 }),
    metadata: Type.Optional(ShareSaleDetails)
})
export const SellForFine = SellAction.schema
export const isSellForFine = SellAction.is

/** The fined player sells shares to pay what their cash could not (§4.3). */
export class HydratedSellForFine extends SellAction.Base {
    declare playerId: string
    declare companyId: Type.Static<typeof SellForFine>['companyId']
    declare shares: Type.Static<typeof SellForFine>['shares']
    declare metadata?: Type.Static<typeof SellForFine>['metadata']
    isValid(state: HydratedState1862): boolean {
        return (
            this.source === ActionSource.User &&
            !!fineSale(state, this.playerId, this.companyId, this.shares).details
        )
    }
    apply(state: HydratedState1862): void {
        const result = fineSale(state, this.playerId, this.companyId, this.shares)
        assert(this.source === ActionSource.User && result.details, result.reason ?? 'Invalid sale')
        applyShareSale(state, result.details)
        const fines = state.fines
        assertExists(fines, 'A fine is owed')
        const paid = Math.min(fines[0].amount, result.details.proceeds)
        settleCashPayments(state, [
            { from: player(this.playerId), to: { kind: 'bank' }, amount: paid }
        ])
        if (paid === fines[0].amount) fines.shift()
        else fines[0].amount -= paid
        if (!fines.length) delete state.fines
        this.metadata = result.details
    }
}

const ForgiveAction = systemAction('ForgiveFine', {
    metadata: Type.Optional(
        Type.Object(
            { playerId: Type.String(), amount: Type.Integer({ minimum: 1 }) },
            { additionalProperties: false }
        )
    )
})
export const ForgiveFine = ForgiveAction.schema
export const isForgiveFine = ForgiveAction.is

/** A fined player with nothing left to sell owes no more (research ruling; §4.3 is silent). */
export class HydratedForgiveFine extends ForgiveAction.Base {
    declare metadata?: Type.Static<typeof ForgiveFine>['metadata']
    apply(state: HydratedState1862): void {
        const fine = state.fines?.[0]
        assert(
            this.source === ActionSource.System &&
                !!fine &&
                !fineSales(state, fine.playerId).length,
            'Only a fine its payer cannot pay is forgiven'
        )
        state.fines?.shift()
        if (!state.fines?.length) delete state.fines
        this.metadata = { ...fine }
    }
}

type Context = MachineContext<HydratedState1862>

/** The fined players sell in turn until each fine is paid or nothing is left to sell. */
export class PayingFineHandler implements EighteenXXStateHandler<HydratedState1862> {
    isValidAction(action: HydratedAction, context: Context): boolean {
        const state = context.gameState
        if (action instanceof HydratedForgiveFine)
            return (
                action.source === ActionSource.System &&
                !!state.fines &&
                !fineSales(state, state.fines[0].playerId).length
            )
        return action instanceof HydratedSellForFine && action.isValid(state)
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const fine = context.gameState.fines?.[0]
        return fine?.playerId === playerId && fineSales(context.gameState, playerId).length
            ? [SellAction.type]
            : []
    }
    enter(context: Context): void {
        const state = context.gameState
        const fine = state.fines?.[0]
        assertExists(fine, 'A fine is owed')
        state.activePlayerIds = [fine.playerId]
        if (!fineSales(state, fine.playerId).length) context.addSystemAction(ForgiveFine, {})
    }
    onAction(_action: HydratedAction, context: Context): string {
        return context.gameState.fines ? PayingFineState : 'StartingOperatingSet'
    }
}

/** Enforces the obligations due as the stock round ends, before the operating rounds (§4.3). */
export function enforcesObligations(
    handler: EighteenXXStateHandler<HydratedState1862>
): EighteenXXStateHandler<HydratedState1862> {
    return new SystemActionFirstHandler(
        handler,
        EnforceObligations,
        (state) => (dueObligations(state).length ? {} : undefined),
        (state) => (state.fines ? PayingFineState : 'StartingOperatingSet')
    )
}

export const ObligationActions = [
    EnforceAction.define((action) => new HydratedEnforceObligations(action)),
    SellAction.define((action) => new HydratedSellForFine(action)),
    ForgiveAction.define((action) => new HydratedForgiveFine(action))
]
