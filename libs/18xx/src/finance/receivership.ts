import { assert } from '@tabletop/common'
import type { PresidencyClaim } from '../stock/presidency.js'
import type { StockState } from '../stock/stockState.js'
import { controllingOwner, getCompany, type FinancialState, type Owner } from './finance.js'

export type PlayerOwner = Extract<Owner, { kind: 'player' }>
export type PresidencyClaimTerms = { price: number; claim: PresidencyClaim }

/** How a title keeps a company going when nobody holds its presidency. */
export interface ReceivershipRules {
    /** The players who act for a company in receivership, the first of them first. */
    operators(state: StockState, companyId: string): string[]
    /** Terms on which a player takes a presidency out of the market during their stock turn. */
    presidencyClaim?(
        state: StockState,
        companyId: string,
        buyer: PlayerOwner
    ): PresidencyClaimTerms | undefined
}

/** A started, open share company with no president, whose president certificate lies in a pool. */
export function inReceivership(state: FinancialState, companyId: string): boolean {
    const company = getCompany(state, companyId)
    return (
        company.kind !== 'private' &&
        !!company.started &&
        !company.closed &&
        !company.president &&
        state.certificates.some(
            (certificate) =>
                certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                !!certificate.president &&
                certificate.poolId !== undefined
        )
    )
}

/**
 * Whether the player may act for the company: its controlling owner, or anyone while it is in
 * receivership, where the step's active players say which receivers act.
 */
export function actsFor(state: FinancialState, playerId: string, companyId: string): boolean {
    const owner = controllingOwner(state, companyId)
    return owner ? owner.playerId === playerId : inReceivership(state, companyId)
}

/** The players who operate the company: its controlling owner, or its receivers. */
export function operatingPlayerIds(
    state: StockState,
    companyId: string,
    rules?: ReceivershipRules
): string[] {
    const owner = controllingOwner(state, companyId)
    if (owner) return [owner.playerId]
    assert(
        rules !== undefined && inReceivership(state, companyId),
        'An operating company requires a controlling owner or a receivership'
    )
    const operators = rules.operators(state, companyId)
    assert(operators.length > 0, 'A receivership requires its operators')
    return operators
}
