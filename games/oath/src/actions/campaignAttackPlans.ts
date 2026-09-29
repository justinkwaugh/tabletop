import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { BattlePlanSide, type CardPower } from '../data/cardPowers.js'
import { usableBattlePlans } from '../util/battlePlans.js'
import { BattlePlanUse, BattlePlanUses } from '../model/battlePlanUse.js'
import { CampaignBattleMetadata, HydratedCampaign, reasonAttackerPlansInvalid } from './campaign.js'

export type CampaignAttackPlansMetadata = Type.Static<typeof CampaignAttackPlansMetadata>
export const CampaignAttackPlansMetadata = Type.Object({ battle: CampaignBattleMetadata })

/** R-5.5.2.a then R-5.5.3 — the attacker's battle plans, once the Citizens asked to join have answered. */
export type CampaignAttackPlans = Type.Static<typeof CampaignAttackPlans>
export const CampaignAttackPlans = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CampaignAttackPlans),
            playerId: Type.String(),
            /** Empty to use none. */
            plans: BattlePlanUses,
            metadata: Type.Optional(CampaignAttackPlansMetadata)
        })
    ])
)

export const CampaignAttackPlansValidator = Compile(CampaignAttackPlans)

export function isCampaignAttackPlans(action?: GameAction): action is CampaignAttackPlans {
    return action?.type === ActionType.CampaignAttackPlans
}

export class HydratedCampaignAttackPlans
    extends HydratableAction<typeof CampaignAttackPlans>
    implements CampaignAttackPlans
{
    declare type: ActionType.CampaignAttackPlans
    declare playerId: string
    declare plans?: BattlePlanUse[]
    declare metadata?: CampaignAttackPlansMetadata

    constructor(data: CampaignAttackPlans) {
        super(data, CampaignAttackPlansValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedCampaignAttackPlans.reasonCannotDeclare(
            state,
            this.playerId,
            this.plans
        )
        if (reason) {
            throw Error(`Cannot use battle plans: ${reason}`)
        }
        const held = state.pendingCampaign
        assertExists(held, 'the attacker declares plans only for a held Campaign')
        state.pendingCampaign = undefined
        const battle = HydratedCampaign.muster(state, {
            ...held.declaration,
            plans: this.plans ?? []
        })
        // R-X.3 — the PRNG moves now, or at the roll this has committed to.
        this.revealsInfo = true
        this.metadata = { battle }
    }

    static reasonCannotDeclare(
        state: HydratedOathGameState,
        playerId: string,
        plans?: readonly BattlePlanUse[]
    ): string | undefined {
        const held = state.pendingCampaign
        if (!held?.awaitingAttackerPlans) return 'no Campaign is waiting on its battle plans'
        const declaration = held.declaration
        if (playerId !== declaration.attackerPlayerId) {
            return 'only the attacker declares the attacking battle plans'
        }
        return reasonAttackerPlansInvalid(
            state,
            playerId,
            HydratedCampaign.partiesOfDeclaration(state, declaration),
            declaration.targets,
            plans
        )
    }

    static usablePlans(state: HydratedOathGameState, playerId: string): CardPower[] {
        const held = state.pendingCampaign
        return held?.awaitingAttackerPlans && held.declaration.attackerPlayerId === playerId
            ? usableBattlePlans(state, playerId, BattlePlanSide.Attacker)
            : []
    }

    static attackerId(state: HydratedOathGameState): string | undefined {
        const held = state.pendingCampaign
        return held?.awaitingAttackerPlans ? held.declaration.attackerPlayerId : undefined
    }
}
