import { CampaignTargetKind, type CampaignTarget, type HydratedOathGameState } from '@tabletop/oath'
import { bannerName, cardName, plural, siteName } from './names.js'

/** A line of the spoils: printed names, or the defender, whose name is their colour chip. */
export type SpoilsItem = { kind: 'text'; text: string } | { kind: 'pawn'; playerId: string }

/** R-5.5.7 resolves the targets in order — sites, then relics and banners, then the pawn. */
export function spoilsSummary(
    state: HydratedOathGameState,
    targets: readonly CampaignTarget[],
    placeCounts: Readonly<Record<string, number>>,
    defenderPlayerId: string | undefined
): SpoilsItem[] {
    return targets.flatMap((target): SpoilsItem[] => {
        switch (target.kind) {
            case CampaignTargetKind.Site: {
                // R-5.5.7.I — "even zero", so the real 0 is shown.
                const placed = plural(placeCounts[target.siteId] ?? 0, 'warband')
                return [{ kind: 'text', text: `${siteName(state, target.siteId)} · ${placed}` }]
            }
            case CampaignTargetKind.Relic:
                return [{ kind: 'text', text: cardName(target.cardId) }]
            case CampaignTargetKind.Banner:
                return [{ kind: 'text', text: `The ${bannerName(target.banner)}` }]
            case CampaignTargetKind.PawnAndFavor:
                return defenderPlayerId === undefined
                    ? []
                    : [{ kind: 'pawn', playerId: defenderPlayerId }]
            case CampaignTargetKind.SiteRelic:
                return []
        }
    })
}
