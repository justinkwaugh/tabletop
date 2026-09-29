import type { Color } from '@tabletop/common'
import {
    banditsRuleSite,
    rulersOfSite,
    rulesCard,
    totalWarbandsAt,
    warbandEntries,
    warbandsAt,
    type HydratedOathGameState,
    type HydratedOathPlayerState
} from '@tabletop/oath'

export type SiteRule = {
    rulerIds: string[]
    banditsRule: boolean
    banditsServeIds: string[]
}

// R-10.21, R-7.6.5 — an empty faceup site is the bandits', unless the Bandit
// Crown's holder rules it through them.
export function siteRuleOf(state: HydratedOathGameState, siteId: string): SiteRule {
    const rulerIds = rulersOfSite(state, siteId)
    const empty = state.isSiteFaceup(siteId) && totalWarbandsAt(state, siteId) === 0
    return {
        rulerIds,
        banditsRule: banditsRuleSite(state, siteId),
        banditsServeIds: empty ? rulerIds : []
    }
}

export function cardRulerIds(state: HydratedOathGameState, cardId: string): string[] {
    return state.players
        .filter((player) => rulesCard(state, player.playerId, cardId))
        .map((player) => player.playerId)
}

export type SitePieces = {
    warbands: [Color, number][]
    pawns: HydratedOathPlayerState[]
    rule: SiteRule
    bandits: boolean
}

// Only one player's warbands are allowed per site; every colour is kept so a broken invariant shows.
export function sitePieces(state: HydratedOathGameState, slotId: string): SitePieces {
    const rule = siteRuleOf(state, slotId)
    return {
        warbands: warbandEntries(warbandsAt(state, slotId)).filter(([, count]) => count > 0),
        pawns: state.players.filter((player) => player.siteId === slotId),
        rule,
        bandits: rule.banditsRule || rule.banditsServeIds.length > 0
    }
}
