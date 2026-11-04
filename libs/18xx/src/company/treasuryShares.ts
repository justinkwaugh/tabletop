import * as Type from 'typebox'
import type { HydratedGameState } from '@tabletop/common'
import { assert } from '@tabletop/common'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { getCompany, type FinancialState } from '../finance/finance.js'
import { actsFor } from '../finance/receivership.js'
import type { OperatingState } from '../operating/operatingSet.js'

const Id = Type.String({ minLength: 1 })
/** A company buying its own shares back (redeem) or selling shares from its treasury (issue). */
export const TreasuryShareOperation = Type.Union([Type.Literal('redeem'), Type.Literal('issue')])
export type TreasuryShareOperation = Type.Static<typeof TreasuryShareOperation>

/** The operating company's share operations this turn, in its step before construction. */
export const ShareStep = Type.Object(
    {
        companyId: Id,
        trades: Type.Array(
            Type.Object(
                { operation: TreasuryShareOperation, shares: Type.Integer({ minimum: 1 }) },
                { additionalProperties: false }
            )
        ),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type ShareStep = Type.Static<typeof ShareStep>
export const TreasuryShareFields = { shareStep: Type.Optional(ShareStep) }
export type TreasuryShareState = FinancialState &
    OperatingState & { shareStep?: ShareStep; machineState: string }
export const TreasuryShareMachineStates = ['ManagingShares'] as const

/**
 * A share operation open to the company: the certificates it redeems from their holders, or
 * issues from its treasury into a pool, for the amount paid; issuing may also set a new par.
 */
export const TreasuryShareChoice = Type.Object(
    {
        operation: TreasuryShareOperation,
        certificateIds: Type.Array(Id, { minItems: 1, uniqueItems: true, default: [] }),
        amount: Type.Integer({ minimum: 0 }),
        poolId: Type.Optional(Id),
        parPrice: Type.Optional(Type.Integer({ minimum: 1 }))
    },
    { additionalProperties: false }
)
export type TreasuryShareChoice = Type.Static<typeof TreasuryShareChoice>

export interface TreasuryShareRules {
    /**
     * The operations open to the operating company now, given the trades already in its share
     * step; none ends the step.
     */
    choices(state: TreasuryShareState, companyId: string): readonly TreasuryShareChoice[]
}

export function shareStepOpen(state: TreasuryShareState, playerId: string, companyId: string) {
    const step = state.shareStep
    return (
        state.machineState === 'ManagingShares' &&
        step?.companyId === companyId &&
        !step.completed &&
        !getCompany(state, companyId).closed &&
        actsFor(state, playerId, companyId)
    )
}

export function sameShareChoice(a: TreasuryShareChoice, b: TreasuryShareChoice): boolean {
    return (
        a.operation === b.operation &&
        a.amount === b.amount &&
        a.poolId === b.poolId &&
        a.parPrice === b.parPrice &&
        a.certificateIds.length === b.certificateIds.length &&
        a.certificateIds.every((id) => b.certificateIds.includes(id))
    )
}

/** Moves the certificates and money of a share operation, returning the payments made. */
export function applyShareChoice(
    state: HydratedGameState & TreasuryShareState,
    companyId: string,
    choice: TreasuryShareChoice
): CashPayment[] {
    const company = { kind: 'company' as const, companyId }
    const certificates = choice.certificateIds.map((id) => {
        const certificate = state.certificates.find((item) => item.id === id)
        assert(
            certificate?.kind === 'share' && certificate.companyId === companyId,
            'A share operation moves the company’s own shares'
        )
        return certificate
    })
    const payments: CashPayment[] = []
    if (choice.operation === 'redeem') {
        const price = choice.amount / certificates.length
        for (const certificate of certificates)
            payments.push({ from: company, to: { ...certificate.owner }, amount: price })
        for (const certificate of certificates) {
            certificate.owner = company
            delete certificate.poolId
        }
    } else {
        assert(choice.poolId, 'Issued shares go to a pool')
        payments.push({ from: { kind: 'bank' }, to: company, amount: choice.amount })
        for (const certificate of certificates) {
            certificate.owner = { kind: 'bank' }
            certificate.poolId = choice.poolId
        }
    }
    const paid = payments.filter((payment) => payment.amount > 0)
    settleCashPayments(state, paid)
    if (choice.parPrice !== undefined) getCompany(state, companyId).parPrice = choice.parPrice
    return paid
}
