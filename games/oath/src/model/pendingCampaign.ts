import * as Type from 'typebox'
import { CampaignTarget, LossSource } from './campaign.js'
import { BattlePlanUses } from './battlePlanUse.js'

/** R-5.5.1, R-5.5.2, R-5.5.3 */
export type CampaignDeclaration = Type.Static<typeof CampaignDeclaration>
export const CampaignDeclaration = Type.Object({
    attackerPlayerId: Type.String(),
    /** R-5.5.1, R-10.3 — absent when attacking the bandits. */
    defenderPlayerId: Type.Optional(Type.String()),
    targets: Type.Array(CampaignTarget, { maxItems: 64 }),
    attackDice: Type.Integer({ minimum: 0, maximum: 999 }),
    plans: BattlePlanUses,
    skullLossOrder: Type.Optional(Type.Array(LossSource, { maxItems: 16 })),
    attackerSiteId: Type.Optional(Type.String()),
    forceSiteIds: Type.Array(Type.String(), { maxItems: 8 }),
    /** Wild Allies, Captains — the site named, one of `forceSiteIds`. */
    asIfSiteId: Type.Optional(Type.String()),
    /** R-5.5.2.a — the Chancellor, then each Citizen who joined with the defender's permission. */
    allyPlayerIds: Type.Array(Type.String(), { maxItems: 8 })
})

/** R-5.5.2.a */
export type PendingCampaign = Type.Static<typeof PendingCampaign>
export const PendingCampaign = Type.Object({
    declaration: CampaignDeclaration,
    /** R-10.2-H1 — clockwise from the attacker; the first is being asked. */
    toAsk: Type.Array(Type.String(), { minItems: 1, maxItems: 8 }),
    /** R-5.5.3 — the Citizens have answered; the attacker's battle plans come next. */
    awaitingAttackerPlans: Type.Optional(Type.Boolean())
})
