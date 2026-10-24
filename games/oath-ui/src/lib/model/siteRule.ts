import {
    banditsPerSite,
    banditsRuleSite,
    banditsServe,
    isImperialSite,
    rulersOfSite,
    rulesCard,
    totalWarbandsAt,
    warbandEntries,
    warbandsAt,
    type HydratedOathGameState,
    type HydratedOathPlayerState,
    type ImperialScope,
    type WarbandOwner
} from '@tabletop/oath'

export type SiteRule = {
    rulerIds: string[]
    banditsRule: boolean
    // R-7.6.5 — the Bandit Crown's holder, at an empty site whose bandits act as their warbands.
    banditsHolderId: string | undefined
    // R-6.6.3 — the Crown's Q&A: an Imperial holder's bandits are the Empire's warbands there.
    banditsImperial: boolean
}

// R-5.5.1.a — from Declare to its end a Campaign may suspend a Citizen, and the board says who
// rules for that Campaign.
function campaignScope(state: HydratedOathGameState): ImperialScope | undefined {
    const campaign = state.campaign
    return campaign ? { nonImperialPlayerIds: campaign.nonImperialPlayerIds } : undefined
}

// R-10.21, R-7.6.5 — an empty faceup site is the bandits', unless the Bandit Crown's holder rules
// it through them. Whether they serve as Imperial warbands is the engine's gated answer, so a
// game created before it keeps the holder alone in the holder's colour.
export function siteRuleOf(state: HydratedOathGameState, siteId: string): SiteRule {
    const scope = campaignScope(state)
    const empty = state.isSiteFaceup(siteId) && totalWarbandsAt(state, siteId) === 0
    const holder = empty
        ? state.players.find((player) => banditsServe(state, player.playerId, siteId, scope))
        : undefined
    return {
        rulerIds: rulersOfSite(state, siteId, scope),
        banditsRule: banditsRuleSite(state, siteId),
        banditsHolderId: holder?.playerId,
        banditsImperial: holder !== undefined && isImperialSite(state, siteId, scope)
    }
}

export function cardRulerIds(state: HydratedOathGameState, cardId: string): string[] {
    return state.players
        .filter((player) => rulesCard(state, player.playerId, cardId))
        .map((player) => player.playerId)
}

export type SitePieces = {
    warbands: [WarbandOwner, number][]
    pawns: HydratedOathPlayerState[]
    rule: SiteRule
    bandits: boolean
    // R-2.8.3 — how many bandits stand there: the engine's count, 0 where none do.
    banditCount: number
}

// Only one player's warbands are allowed per site; every owner is kept so a broken invariant shows.
export function sitePieces(state: HydratedOathGameState, slotId: string): SitePieces {
    const rule = siteRuleOf(state, slotId)
    const bandits = rule.banditsRule || rule.banditsHolderId !== undefined
    return {
        warbands: warbandEntries(warbandsAt(state, slotId)).filter(([, count]) => count > 0),
        pawns: state.players.filter((player) => player.siteId === slotId),
        rule,
        bandits,
        banditCount: bandits ? banditsPerSite(state) : 0
    }
}
