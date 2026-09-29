import { HydratedOathGameState } from '../model/gameState.js'
import { Banner } from '../model/oathEnums.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import type { BattlePlanUse } from '../model/battlePlanUse.js'
import type { CampaignDefender } from '../actions/campaign.js'
import { plansTargetSiteRelics } from './battlePlans.js'
import { bannerHolder } from './oathkeeper.js'
import { banditsRuleSite, sitesRuledBy } from './rule.js'

/** R-5.5.2, R-10.21 */
export function sitesDefendedBy(
    state: HydratedOathGameState,
    defender: CampaignDefender
): string[] {
    if (defender.kind === 'bandits') {
        return state.allSiteIds().filter((siteId) => banditsRuleSite(state, siteId))
    }
    return sitesRuledBy(state, defender.playerId)
}

/** R-5.5.2, R-10.3 — `reasonCannotDeclareTargets` judges the set as a whole. */
export function campaignTargetOptions(
    state: HydratedOathGameState,
    defender: CampaignDefender,
    plans: readonly BattlePlanUse[],
    chosen: readonly CampaignTarget[]
): CampaignTarget[] {
    const siteIds = sitesDefendedBy(state, defender)
    const sites = siteIds.map(
        (siteId): CampaignTarget => ({ kind: CampaignTargetKind.Site, siteId })
    )
    const siteRelics = plansTargetSiteRelics(plans)
        ? chosen.flatMap((target) =>
              target.kind === CampaignTargetKind.Site && siteIds.includes(target.siteId)
                  ? state.relicSlotsAt(target.siteId).map(
                        (slot): CampaignTarget => ({
                            kind: CampaignTargetKind.SiteRelic,
                            slotId: slot.slotId
                        })
                    )
                  : []
          )
        : []
    if (defender.kind === 'bandits') return [...sites, ...siteRelics]

    const them = state.getPlayerState(defender.playerId)
    const relics = them.relicIds.map(
        (cardId): CampaignTarget => ({ kind: CampaignTargetKind.Relic, cardId })
    )
    const banners = Object.values(Banner)
        .filter((banner) => bannerHolder(state, banner) === them.playerId)
        .map((banner): CampaignTarget => ({ kind: CampaignTargetKind.Banner, banner }))
    return [
        ...sites,
        ...relics,
        ...banners,
        { kind: CampaignTargetKind.PawnAndFavor },
        ...siteRelics
    ]
}
