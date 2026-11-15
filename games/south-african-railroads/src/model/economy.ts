import type { SarMap } from '../maps/maps.js'
import type { RailroadId } from '../maps/types.js'
import { railroadLinkIds, type TrackState } from './track.js'

export const SHARES_PER_RAILROAD = 5

export type DevelopmentState = { map: SarMap; developments: Record<string, number> }

export function developmentLevel(state: DevelopmentState, settlementId: string): number {
    return state.developments[settlementId] ?? 0
}

export function settlementIncome(state: DevelopmentState, settlementId: string): number {
    return state.map.incomeLevels(settlementId)[developmentLevel(state, settlementId)]
}

export function linkIncome(state: DevelopmentState, linkId: string): number {
    const [a, b] = state.map.link(linkId).ends
    return settlementIncome(state, a) + settlementIncome(state, b)
}

export type IncomeGain = { railroadId: RailroadId; gain: number }

// What one more development at a settlement adds to the income of each railroad serving it: the
// step up its income track, once for every link of the railroad into it.
export function developmentIncomeGains(
    state: TrackState & DevelopmentState,
    settlementId: string
): IncomeGain[] {
    const levels = state.map.incomeLevels(settlementId)
    const level = developmentLevel(state, settlementId)
    const step = levels[level + 1] - levels[level]
    return state.map.railroads
        .map((railroad) => ({
            railroadId: railroad.id,
            gain:
                step *
                railroadLinkIds(state, railroad.id).filter((linkId) =>
                    state.map.link(linkId).ends.includes(settlementId)
                ).length
        }))
        .filter((entry) => entry.gain > 0)
}

export function railroadIncome(state: TrackState & DevelopmentState, railroadId: RailroadId) {
    return railroadLinkIds(state, railroadId).reduce(
        (sum, linkId) => sum + linkIncome(state, linkId),
        0
    )
}

export function dividendPerShare(income: number): number {
    return Math.ceil(income / SHARES_PER_RAILROAD)
}

export function specialDividendPerShare(income: number): number {
    return Math.floor(income / SHARES_PER_RAILROAD)
}

// In a recovery round every dividend, special ones included, pays a tenth, rounded down.
export function recoveryDividendPerShare(income: number): number {
    return Math.floor(income / (2 * SHARES_PER_RAILROAD))
}

export function finalPayoffPerShare(value: number, income: number, sharesSold: number): number {
    return sharesSold === 0 ? 0 : Math.ceil((value + income) / sharesSold)
}

export function minimumBid(value: number): number {
    return Math.ceil(value / SHARES_PER_RAILROAD)
}
