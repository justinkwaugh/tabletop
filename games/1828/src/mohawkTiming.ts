import {
    floatedCompaniesInMarketOrder,
    hasTurnMark,
    nextOperatingCompany,
    reorderPendingOperatingCompanies,
    type OperatingState
} from '@tabletop/18xx'
import { cobourgOperates } from './cobourg.js'
import { CobourgRailwayId } from './ids.js'
import type { HydratedState1828 } from './state.js'
import { Market1828 } from './stockMarket.js'

/** The operating share company has begun its turn. */
export const OperatingStartedMark = 'operating-started'

/** The operating order: a player's C&P as the privates pay, then companies by price (§8.1, §8.2). */
export function operatingOrder1828(state: OperatingState): string[] {
    return [
        ...(cobourgOperates(state) ? [CobourgRailwayId] : []),
        ...floatedCompaniesInMarketOrder(Market1828, state)
    ]
}

/**
 * Whether no share company has yet operated this operating round (§13.2.2.6): the first has done
 * nothing of its turn, which its first act, a home station included, begins.
 */
export function noShareCompanyHasOperated(state: HydratedState1828): boolean {
    const set = state.operatingSet
    if (!set || set.completed || !set.privateIncomePaid) return false
    if (set.completedCompanyIds.some((companyId) => companyId !== CobourgRailwayId)) return false
    if (nextOperatingCompany(state) === CobourgRailwayId) return true
    return (
        !!state.turnManager.currentTurn() &&
        !hasTurnMark(state, OperatingStartedMark) &&
        ['OperatingSet', 'LayingTrack'].includes(state.machineState)
    )
}

/**
 * A company the M&H floats during an operating round takes its place in that round while no share
 * company has operated, and otherwise waits for the next (§13.2.2.6).
 */
export function admitMohawkFloat(state: HydratedState1828): void {
    if (state.machineState === 'StockRound' || !noShareCompanyHasOperated(state)) return
    reorderPendingOperatingCompanies(state, operatingOrder1828(state), {
        betweenCompanies: true,
        admitsLaterCompanies: true
    })
}
