import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    CashPayment,
    SystemActionFirstHandler,
    companyShareCount,
    getCompany,
    settleCashPayments,
    systemAction,
    nextOperatingCompany,
    openShares,
    type FinancialState,
    type OperatingState,
    type Owner,
    type SharePurchaseDetails,
    type TrainState
} from '@tabletop/18xx'
import { CgrId } from './ids.js'
import { IpoPoolId1856 } from './names.js'
import * as Type from 'typebox'
import {
    requireState1856,
    type Capitalization1856,
    type CompanyFunding1856,
    type HydratedState1856,
    type StateHandler1856
} from './state.js'
import { Charters1856 } from './charters.js'
import { trainTypeOnSale } from './trains.js'

/** Escrow companies receive the payments for their first five shares from the initial offering. */
export const EscrowFreeShares = 5

/**
 * The capitalization a company started now receives: escrow while a 2, 3 or 4 is on sale,
 * incremental with the 5s, full from the 6s (Public Company Starting Treasury).
 */
export function capitalizationOnSale(state: TrainState): Capitalization1856 {
    const type = trainTypeOnSale(state.trainInventory)
    return type < 5 ? 'escrow' : type === 5 ? 'incremental' : 'full'
}

export function companyFunding(state: object, companyId: string): CompanyFunding1856 | undefined {
    return requireState1856(state).funding.find((entry) => entry.companyId === companyId)
}

export function destinationReached(state: object, companyId: string): boolean {
    return requireState1856(state).destinationsReached.includes(companyId)
}

/** Shares sold from the initial offering, to players or since sold to the open market. */
export function initialSharesSold(state: FinancialState, companyId: string): number {
    const count = companyShareCount(state, Charters1856, companyId)
    assertExists(count, 'A public company has shares')
    const unsold = openShares(state, companyId)
        .filter(
            (certificate) =>
                certificate.owner.kind === 'bank' && certificate.poolId === IpoPoolId1856
        )
        .reduce((sum, certificate) => sum + certificate.shares, 0)
    return count - unsold
}

/**
 * Who receives the payment for a share bought from the initial offering: an incremental company,
 * an escrow company for its first five shares or once at its destination, the bank otherwise.
 * The CGR's and fully capitalized companies' go to the bank (Public Company Starting Treasury,
 * CGR Treasury).
 */
export function initialOfferingRecipient(
    state: FinancialState,
    companyId: string,
    capitalization: Capitalization1856 | undefined
): Owner {
    const company: Owner = { kind: 'company', companyId }
    if (companyId === CgrId || capitalization === 'full' || !capitalization) return { kind: 'bank' }
    if (capitalization === 'incremental' || destinationReached(state, companyId)) return company
    return initialSharesSold(state, companyId) < EscrowFreeShares ? company : { kind: 'bank' }
}

/**
 * A closed company's capitalization and destination no longer matter: it never restarts, and
 * its escrow stays with the bank (Closed Section; designer, on the CGR).
 */
export function forgetClosedCompany(state: object, companyId: string): void {
    const title = requireState1856(state)
    title.funding = title.funding.filter((entry) => entry.companyId !== companyId)
    title.destinationsReached = title.destinationsReached.filter((id) => id !== companyId)
}

/** A share's payment for an escrow company beyond its first five goes into escrow. */
export function recordEscrow(state: object, details: SharePurchaseDetails): void {
    const funding = companyFunding(state, details.companyId)
    if (funding?.capitalization !== 'escrow' || destinationReached(state, details.companyId)) return
    if (details.poolId !== IpoPoolId1856) return
    const held = details.payments
        .filter((payment) => payment.to.kind === 'bank')
        .reduce((sum, payment) => sum + payment.amount, 0)
    if (held) funding.escrow = (funding.escrow ?? 0) + held
}

/**
 * A company that has not yet operated may operate once it has sold from the initial offering at
 * least as many shares as the type of train on sale, a final train counting as a 6 (Initial
 * Shares Needed to Operate).
 */
export function meetsOperatingThreshold(
    state: FinancialState & TrainState,
    companyId: string
): boolean {
    return initialSharesSold(state, companyId) >= trainTypeOnSale(state.trainInventory)
}

export function sharesStillToOperate(
    state: FinancialState & TrainState,
    companyId: string
): number {
    return Math.max(0, trainTypeOnSale(state.trainInventory) - initialSharesSold(state, companyId))
}

/**
 * A company floats only as its first turn comes and only if it then meets its threshold; a fully
 * capitalized company has had its capital already, at its sixth share (`CapitalizeCompany`).
 */
export function firstOperationPayments(
    state: FinancialState & TrainState & OperatingState,
    companyId: string
): CashPayment[] | undefined {
    if (companyId === CgrId || nextOperatingCompany(state) !== companyId) return undefined
    return meetsOperatingThreshold(state, companyId) ? [] : undefined
}

/** The initial-offering shares a fully capitalized company sells before it receives its capital. */
export const FullCapitalizationShares = 6

/** The fully capitalized company owed its capital, its sixth initial-offering share sold. */
function capitalDue(state: HydratedState1856): string | undefined {
    return state.funding.find(
        (funding) =>
            funding.capitalization === 'full' &&
            !funding.capitalized &&
            !getCompany(state, funding.companyId).closed &&
            initialSharesSold(state, funding.companyId) >= FullCapitalizationShares
    )?.companyId
}

const CapitalizeCompanyAction = systemAction('CapitalizeCompany', {
    companyId: Type.String({ minLength: 1 }),
    metadata: Type.Optional(Type.Object({ payment: CashPayment }, { additionalProperties: false }))
})
export const CapitalizeCompany = CapitalizeCompanyAction.schema
export type CapitalizeCompany = Type.Static<typeof CapitalizeCompany>
export const isCapitalizeCompany = CapitalizeCompanyAction.is

/**
 * A company started from the 6s receives ten times its par from the bank as soon as six shares
 * have been sold from the initial offering, and nothing for later sales (Public Company Starting
 * Treasury).
 */
class HydratedCapitalizeCompany extends CapitalizeCompanyAction.Base implements CapitalizeCompany {
    declare type: 'CapitalizeCompany'
    declare companyId: string
    declare metadata?: CapitalizeCompany['metadata']
    apply(state: HydratedState1856): void {
        assert(
            this.source === ActionSource.System && capitalDue(state) === this.companyId,
            'A company is capitalized once, by the system, at its sixth share'
        )
        const funding = state.funding.find((entry) => entry.companyId === this.companyId)
        assertExists(funding, 'A started company has its capitalization')
        const par = getCompany(state, this.companyId).parPrice
        assertExists(par, 'A started company has a par')
        const payment: CashPayment = {
            from: { kind: 'bank' },
            to: { kind: 'company', companyId: this.companyId },
            amount: par * 10
        }
        settleCashPayments(state, [payment])
        funding.capitalized = true
        this.metadata = { payment }
    }
}

export const CapitalizationActions1856 = [
    CapitalizeCompanyAction.define((action) => new HydratedCapitalizeCompany(action))
]

/** After a share purchase, a fully capitalized company at its sixth share receives its capital. */
export function capitalizesCompanies(handler: StateHandler1856): StateHandler1856 {
    return new SystemActionFirstHandler(handler, CapitalizeCompany, (stateObject) => {
        const companyId = capitalDue(requireState1856(stateObject))
        return companyId ? { companyId } : undefined
    })
}
