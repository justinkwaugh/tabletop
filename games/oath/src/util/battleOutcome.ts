import { BattlePlanSide } from '../data/cardPowers.js'
import { HydratedOathGameState } from '../model/gameState.js'
import type { CampaignState } from '../model/campaign.js'
import { plansUsedBy, playerIdsOnSide, type ActiveBattlePlan } from './battlePlans.js'

/** R-5.5.6, R-5.5.8 — the victor's plan that takes the defeated side's survivors (the Obsidian Cage), and its user. */
export function survivorsTakingPlan(
    state: HydratedOathGameState,
    campaign: CampaignState,
    victorSide: BattlePlanSide
): { playerId: string; plan: ActiveBattlePlan } | undefined {
    for (const playerId of playerIdsOnSide(campaign, victorSide)) {
        for (const plan of plansUsedBy(state, campaign, playerId)) {
            if (plan.hooks.takesEnemySurvivors) return { playerId, plan }
        }
    }
    return undefined
}

/** The cards a Campaign's record says settled its outcome. */
export interface DecidingPlans {
    /** Hearts and Minds, Peace Envoy — the plan whose "you're victorious now" decided the battle. */
    victory?: string
    /** The Obsidian Cage — the victor's plan that took the defeated side's survivors. */
    survivors?: string
}

/**
 * R-5.5.3, R-5.5.6 — read from the record alone (`decidedVictor`, `attackerVictorious`,
 * `plansUsed`, `plansUsedBy`): the deciding plan is the first used on the side it made victorious,
 * as the engine keeps the first decision; the survivors' taker is the one the battle's end used.
 * Reads nothing hidden and changes nothing, so a seat's projected view gives the same answer.
 */
export function decidingPlans(
    state: HydratedOathGameState,
    campaign: CampaignState
): DecidingPlans {
    const decided: DecidingPlans = {}
    if (campaign.decidedVictor) {
        const side =
            campaign.decidedVictor === 'attacker'
                ? BattlePlanSide.Attacker
                : BattlePlanSide.Defender
        const deciding = new Set(
            playerIdsOnSide(campaign, side)
                .flatMap((playerId) => plansUsedBy(state, campaign, playerId))
                .filter((plan) => plan.hooks.decidesVictor)
                .map((plan) => plan.power.cardId)
        )
        const victory = campaign.plansUsed.find((cardId) => deciding.has(cardId))
        if (victory) decided.victory = victory
    }
    if (campaign.attackerVictorious !== undefined) {
        const victorSide = campaign.attackerVictorious
            ? BattlePlanSide.Attacker
            : BattlePlanSide.Defender
        const taker = survivorsTakingPlan(state, campaign, victorSide)
        if (taker) decided.survivors = taker.plan.power.cardId
    }
    return decided
}
