import { CampaignTargetKind, type CampaignTarget, type HydratedOathGameState } from '@tabletop/oath'
import { bannerName, cardName, plural, siteName } from './names.js'

/** R-5.5.7 resolves the targets in order — sites, then relics and banners, then the pawn. */
export function spoilsSummary(
    state: HydratedOathGameState,
    targets: readonly CampaignTarget[],
    placeCounts: Readonly<Record<string, number>>
): string[] {
    return targets.flatMap((target) => {
        switch (target.kind) {
            case CampaignTargetKind.Site: {
                const placed = placeCounts[target.siteId] ?? 0
                return [
                    `rule of ${siteName(state, target.siteId)}${
                        placed > 0
                            ? ` with ${plural(placed, 'warband')} placed`
                            : ' (no warbands placed — the bandits keep it)'
                    }`
                ]
            }
            case CampaignTargetKind.Relic:
                return [cardName(target.cardId)]
            case CampaignTargetKind.Banner:
                return [`the ${bannerName(target.banner)}`]
            case CampaignTargetKind.PawnAndFavor:
                return ['their pawn sent away']
            case CampaignTargetKind.SiteRelic:
                return []
        }
    })
}
