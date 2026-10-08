import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { type CampaignState } from '../model/campaign.js'
import { BattlePlanSide, type CardPower } from '../data/cardPowers.js'
import { applyBattlePlans, resolveBattlePlans, usableBattlePlans } from '../util/battlePlans.js'
import { partiesOf, rollCampaign } from '../util/campaignRoll.js'
import { forceTotal } from '../util/force.js'
import { BattlePlanUse, BattlePlanUses } from '../model/battlePlanUse.js'

export type CampaignDefendMetadata = Type.Static<typeof CampaignDefendMetadata>
export const CampaignDefendMetadata = Type.Object({
    plansUsed: Type.Array(Type.String()),
    planNotes: Type.Optional(Type.Array(Type.String())),
    attackPool: Type.Number(),
    defensePool: Type.Number(),
    defense: Type.Number(),
    swords: Type.Number(),
    skullsKilled: Type.Number(),
    /** R-5.5.3.a */
    awaitingMore: Type.Optional(Type.Array(Type.String()))
})

export type CampaignDefend = Type.Static<typeof CampaignDefend>
export const CampaignDefend = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CampaignDefend),
            playerId: Type.String(),
            /** R-5.5.3 — empty to decline. */
            plans: BattlePlanUses,
            metadata: Type.Optional(CampaignDefendMetadata)
        })
    ])
)

export const CampaignDefendValidator = Compile(CampaignDefend)

export function isCampaignDefend(action?: GameAction): action is CampaignDefend {
    return action?.type === ActionType.CampaignDefend
}

export class HydratedCampaignDefend
    extends HydratableAction<typeof CampaignDefend>
    implements CampaignDefend
{
    declare type: ActionType.CampaignDefend
    declare playerId: string
    declare plans?: BattlePlanUse[]
    declare metadata?: CampaignDefendMetadata

    constructor(data: CampaignDefend) {
        super(data, CampaignDefendValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedCampaignDefend.reasonCannotDefend(state, this.playerId, this.plans)
        if (reason) {
            throw Error(`Cannot use battle plans: ${reason}`)
        }
        const campaign = state.campaign
        assertExists(campaign, 'Battle plans require a Campaign in progress')
        const pending = campaign.pendingDefenderPlans

        const active = resolveBattlePlans(
            state,
            this.playerId,
            BattlePlanSide.Defender,
            this.plans,
            partiesOf(state, campaign)
        ).active
        const outcome = applyBattlePlans(
            state,
            this.playerId,
            active,
            { attackPool: campaign.attackPool, defensePool: campaign.defensePool },
            { parties: partiesOf(state, campaign), side: BattlePlanSide.Defender }
        )
        campaign.attackPool = outcome.pools.attackPool
        campaign.defensePool = outcome.pools.defensePool
        campaign.plansUsed = [...campaign.plansUsed, ...outcome.used]
        campaign.discardAtEnd = [...campaign.discardAtEnd, ...outcome.discardAtEnd]
        if (outcome.used.length > 0) {
            campaign.plansUsedBy = { ...campaign.plansUsedBy, [this.playerId]: outcome.used }
        }
        campaign.rollRules = { ...campaign.rollRules, ...outcome.rollRules }
        // Code of Honor — the rest of the defending side may use none (R-10.28-H1).
        if (outcome.exclusive) campaign.defenderPlansLocked = true
        // Hearts and Minds — "as defender, you're victorious now"; the first decision stands.
        if (outcome.decidesVictor && !campaign.decidedVictor) campaign.decidedVictor = 'defender'
        if (outcome.ignoreDefeatKills) campaign.ignoreDefeatKills = true
        if (outcome.ignoreSkulls) campaign.ignoreSkulls = true
        campaign.killRedirects = [...campaign.killRedirects, ...outcome.killRedirects]

        const remaining = campaign.defenderPlansLocked
            ? []
            : HydratedCampaignDefend.answeringQueue(campaign).slice(1)
        let skullsKilled = 0
        if (remaining.length > 0) {
            campaign.pendingDefenderPlans = { ...pending, queue: remaining }
        } else {
            campaign.pendingDefenderPlans = undefined
            skullsKilled = forceTotal(rollCampaign(state, campaign, pending?.skullLossOrder))
        }

        // R-X.3 — the PRNG moved, or a plan was declared for it to move on.
        this.revealsInfo = true

        this.metadata = {
            plansUsed: outcome.used,
            planNotes: outcome.notes.length > 0 ? outcome.notes : undefined,
            attackPool: campaign.attackPool,
            defensePool: campaign.defensePool,
            defense: campaign.defense,
            swords: campaign.swords,
            skullsKilled,
            awaitingMore: remaining.length > 0 ? remaining : undefined
        }
    }

    static answeringQueue(campaign: CampaignState): string[] {
        return campaign.pendingDefenderPlans?.queue ?? []
    }

    static answeringPlayerId(state: HydratedOathGameState): string | undefined {
        return state.campaign ? HydratedCampaignDefend.answeringQueue(state.campaign)[0] : undefined
    }

    static reasonCannotDefend(
        state: HydratedOathGameState,
        playerId: string,
        plans?: readonly BattlePlanUse[]
    ): string | undefined {
        const campaign = state.campaign
        if (!campaign) return 'no Campaign is under way'
        if (!campaign.pendingDefenderPlans) return 'the battle-plan step is not open'
        if (campaign.defenderPlansLocked && (plans?.length ?? 0) > 0) {
            return 'the defending side cannot use battle plans in this Campaign (Specialist, Code of Honor)'
        }
        const answering = HydratedCampaignDefend.answeringQueue(campaign)[0]
        if (playerId !== answering) {
            if (answering !== undefined && answering !== campaign.defenderPlayerId) {
                return "an ally is answering with the defender's battle plans (R-5.5.3.a)"
            }
            return "only the defender and their allies use the defender's battle plans (R-5.5.3)"
        }
        // R-5.5.3 — "a specific battle plan cannot be used by multiple players".
        const taken = plans?.find((plan) => campaign.plansUsed.includes(plan.cardId))
        if (taken) return `${taken.cardId}'s battle plan is already used in this Campaign`
        return resolveBattlePlans(
            state,
            playerId,
            BattlePlanSide.Defender,
            plans,
            partiesOf(state, campaign)
        ).reason
    }

    static usablePlans(state: HydratedOathGameState, playerId: string): CardPower[] {
        if (HydratedCampaignDefend.reasonCannotDefend(state, playerId, [])) return []
        const campaign = state.campaign
        assertExists(campaign, 'a defender answers only while a Campaign is under way')
        if (campaign.defenderPlansLocked) return []
        return usableBattlePlans(
            state,
            playerId,
            BattlePlanSide.Defender,
            partiesOf(state, campaign)
        ).filter((plan) => !campaign.plansUsed.includes(plan.cardId))
    }

    static canDoCampaignDefend(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedCampaignDefend.reasonCannotDefend(state, playerId, []) === undefined
    }
}
