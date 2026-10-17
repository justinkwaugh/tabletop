import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { type CampaignState } from '../model/campaign.js'
import { BattlePlanSide, type CardPower } from '../data/cardPowers.js'
import {
    applyBattlePlans,
    playerIdsOnSide,
    resolveBattlePlans,
    usableBattlePlans
} from '../util/battlePlans.js'
import { partiesOf, rollCampaign } from '../util/campaignRoll.js'
import { forceTotal } from '../util/force.js'
import { BattlePlanUse, BattlePlanUses } from '../model/battlePlanUse.js'
import { effectFor } from '../powers/registry.js'
import { OathRevision, isAtLeastOathRevision } from '../util/revision.js'

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
            { parties: partiesOf(state, campaign), side: BattlePlanSide.Defender },
            campaign
        )
        campaign.attackPool = outcome.pools.attackPool
        campaign.defensePool = outcome.pools.defensePool
        campaign.plansUsed = [...campaign.plansUsed, ...outcome.used]
        campaign.discardAtEnd = [...campaign.discardAtEnd, ...outcome.discardAtEnd]
        if (outcome.used.length > 0) {
            campaign.plansUsedBy = { ...campaign.plansUsedBy, [this.playerId]: outcome.used }
        }
        campaign.rollRules = { ...campaign.rollRules, ...outcome.rollRules }
        // Code of Honor — the rest of the defending side may use none (R-10.28-H1). Peace Envoy's
        // "you cannot use other battle plans" binds its user alone; before revision 14 it locked
        // the side too.
        const locksSide = isAtLeastOathRevision(state, OathRevision.EngineFixes10)
            ? outcome.locksOwnSide
            : outcome.exclusive
        if (locksSide) campaign.defenderPlansLocked = true
        // Hearts and Minds — "as defender, you're victorious now"; the first decision stands.
        if (outcome.decidesVictor && !campaign.decidedVictor) campaign.decidedVictor = 'defender'
        if (outcome.ignoreDefeatKills) campaign.ignoreDefeatKills = true
        if (outcome.ignoreSkulls) campaign.ignoreSkulls = true

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
        const resolved = resolveBattlePlans(
            state,
            playerId,
            BattlePlanSide.Defender,
            plans,
            partiesOf(state, campaign)
        )
        if (resolved.reason) return resolved.reason
        for (const plan of resolved.active) {
            const locked = HydratedCampaignDefend.reasonSideHasUsedPlans(
                state,
                campaign,
                plan.power
            )
            if (locked) return locked
        }
        return undefined
    }

    /**
     * R-5.5.3-H3 — Code of Honor binds its whole side whatever order the side answers in: once anyone
     * on the defending side has used another battle plan, no one on it may use Code of Honor. The
     * attacker's plans are the other side's. R-X.4: before revision 13 it was judged forward only.
     */
    private static reasonSideHasUsedPlans(
        state: HydratedOathGameState,
        campaign: CampaignState,
        power: CardPower
    ): string | undefined {
        if (!isAtLeastOathRevision(state, OathRevision.EngineFixes9)) return undefined
        if (!effectFor(power)?.battlePlan?.locksOwnSide) return undefined
        const sideHasUsed = playerIdsOnSide(campaign, BattlePlanSide.Defender).some(
            (sidePlayerId) => (campaign.plansUsedBy[sidePlayerId]?.length ?? 0) > 0
        )
        return sideHasUsed
            ? `${power.cardId}: your side has already used another battle plan`
            : undefined
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
        ).filter(
            (plan) =>
                !campaign.plansUsed.includes(plan.cardId) &&
                !HydratedCampaignDefend.reasonSideHasUsedPlans(state, campaign, plan)
        )
    }

    static canDoCampaignDefend(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedCampaignDefend.reasonCannotDefend(state, playerId, []) === undefined
    }
}
