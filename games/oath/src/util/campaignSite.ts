import { HydratedOathGameState } from '../model/gameState.js'
import { CampaignTargetKind } from '../model/campaign.js'
import type { CampaignParties } from './campaign.js'
import { campaignAsIfSiteNow } from './freeActions.js'
import { pawnSiteId } from './pawn.js'

/** R-5.5.1's "your site" — the pawn's, unless a card said to act as if elsewhere. */
export function attackingSiteOf(state: HydratedOathGameState, playerId: string): string {
    // Mid-Campaign the record rules: the card's flag is consumed when the Campaign starts.
    const campaign = state.campaign
    if (campaign?.attackerPlayerId === playerId && campaign.attackerSiteId)
        return campaign.attackerSiteId
    return campaignAsIfSiteNow(state, playerId) ?? pawnSiteId(state, playerId)
}

export function targetedSiteIds(parties: CampaignParties): string[] {
    const siteIds: string[] = []
    for (const target of parties.targets) {
        if (target.kind === CampaignTargetKind.Site) siteIds.push(target.siteId)
    }
    return siteIds
}

/** R-11.4, R-11.13 — "targets at this site": a site, a relic lying there, or what the defender's pawn there holds. */
export function sitesWithTargets(state: HydratedOathGameState, parties: CampaignParties): string[] {
    const siteIds = new Set<string>()
    for (const target of parties.targets) {
        switch (target.kind) {
            case CampaignTargetKind.Site:
                siteIds.add(target.siteId)
                break
            case CampaignTargetKind.SiteRelic: {
                const at = state.findRelicSlot(target.slotId)?.siteId
                if (at) siteIds.add(at)
                break
            }
            case CampaignTargetKind.Relic:
            case CampaignTargetKind.Banner:
            case CampaignTargetKind.PawnAndFavor:
                if (parties.defenderPlayerId) {
                    siteIds.add(pawnSiteId(state, parties.defenderPlayerId))
                }
        }
    }
    return [...siteIds]
}
