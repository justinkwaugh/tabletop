import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { WarbandGroup } from '../model/campaign.js'
import {
    killPickedSkullLosses,
    reasonSkullLossesInvalid,
    skullLossGroups
} from '../util/campaignRoll.js'

export type CampaignSkullLossesMetadata = Type.Static<typeof CampaignSkullLossesMetadata>
export const CampaignSkullLossesMetadata = Type.Object({
    /** R-5.5.5 — one group per place and owner, in the force's order. */
    killed: Type.Array(WarbandGroup, { maxItems: 16 })
})

/** R-5.5.5 — from revision 7, where the skulls kill, picked by the attacker after the roll. */
export type CampaignSkullLosses = Type.Static<typeof CampaignSkullLosses>
export const CampaignSkullLosses = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CampaignSkullLosses),
            playerId: Type.String(),
            kills: Type.Array(WarbandGroup, { maxItems: 64 }),
            metadata: Type.Optional(CampaignSkullLossesMetadata)
        })
    ])
)

export const CampaignSkullLossesValidator = Compile(CampaignSkullLosses)

export function isCampaignSkullLosses(action?: GameAction): action is CampaignSkullLosses {
    return action?.type === ActionType.CampaignSkullLosses
}

export class HydratedCampaignSkullLosses
    extends HydratableAction<typeof CampaignSkullLosses>
    implements CampaignSkullLosses
{
    declare type: ActionType.CampaignSkullLosses
    declare playerId: string
    declare kills: WarbandGroup[]
    declare metadata?: CampaignSkullLossesMetadata

    constructor(data: CampaignSkullLosses) {
        super(data, CampaignSkullLossesValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedCampaignSkullLosses.reasonCannotPick(
            state,
            this.playerId,
            this.kills
        )
        if (reason) {
            throw Error(`Cannot pick the skulls' losses: ${reason}`)
        }
        const campaign = state.campaign
        assertExists(campaign, 'Skull losses are picked only mid-Campaign')
        this.metadata = { killed: killPickedSkullLosses(state, campaign, this.kills) }
    }

    /** R-5.5.5 — how many the pick must kill. */
    static skulls(state: HydratedOathGameState): number {
        return state.campaign?.pendingSkullLosses?.skulls ?? 0
    }

    /** R-5.5.5, R-10.22 — the places and owners the pick may take from, with what each holds. */
    static sources(state: HydratedOathGameState): WarbandGroup[] {
        const campaign = state.campaign
        return campaign?.pendingSkullLosses ? skullLossGroups(state, campaign) : []
    }

    static reasonCannotPick(
        state: HydratedOathGameState,
        playerId: string,
        kills: readonly WarbandGroup[]
    ): string | undefined {
        return reasonSkullLossesInvalid(state, playerId, kills)
    }

    static canDoCampaignSkullLosses(state: HydratedOathGameState, playerId: string): boolean {
        const campaign = state.campaign
        return campaign?.pendingSkullLosses !== undefined && campaign.attackerPlayerId === playerId
    }
}
