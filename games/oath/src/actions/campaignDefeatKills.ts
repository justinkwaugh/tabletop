import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { WarbandGroup } from '../model/campaign.js'
import { PileDeposit } from '../model/hidden.js'
import { forceTotal, selectionExceedsForce } from '../util/force.js'
import { commitHiddenOutputs } from '../util/hiddenInputs.js'
import { HydratedCampaignSacrifice } from './campaignSacrifice.js'

export type CampaignDefeatKillsMetadata = Type.Static<typeof CampaignDefeatKillsMetadata>
export const CampaignDefeatKillsMetadata = Type.Object({
    /** R-5.5.6 */
    defeatKilled: Type.Number(),
    /** R-5.5.8 */
    planNotes: Type.Optional(Type.Array(Type.String())),
    /** R-5.5.8, R-9.4 */
    pileDeposits: Type.Optional(Type.Array(PileDeposit, { maxItems: 8 }))
})

/** R-5.5.6, R-5.5.6.a — chosen by the defeated side. */
export type CampaignDefeatKills = Type.Static<typeof CampaignDefeatKills>
export const CampaignDefeatKills = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CampaignDefeatKills),
            playerId: Type.String(),
            kills: Type.Array(WarbandGroup, { maxItems: 64 }),
            metadata: Type.Optional(CampaignDefeatKillsMetadata)
        })
    ])
)

export const CampaignDefeatKillsValidator = Compile(CampaignDefeatKills)

export function isCampaignDefeatKills(action?: GameAction): action is CampaignDefeatKills {
    return action?.type === ActionType.CampaignDefeatKills
}

export class HydratedCampaignDefeatKills
    extends HydratableAction<typeof CampaignDefeatKills>
    implements CampaignDefeatKills
{
    declare type: ActionType.CampaignDefeatKills
    declare playerId: string
    declare kills: WarbandGroup[]
    declare metadata?: CampaignDefeatKillsMetadata

    constructor(data: CampaignDefeatKills) {
        super(data, CampaignDefeatKillsValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedCampaignDefeatKills.reasonCannotChoose(
            state,
            this.playerId,
            this.kills
        )
        if (reason) {
            throw Error(`Cannot choose the losses: ${reason}`)
        }
        const campaign = state.campaign
        assertExists(campaign, 'Losses are chosen only mid-Campaign')
        campaign.pendingDefeatKills = undefined

        const { defeatKilled, planNotes, pileDeposits } = HydratedCampaignSacrifice.finishBattle(
            state,
            campaign,
            this.kills
        )
        this.metadata = { defeatKilled, planNotes, pileDeposits }

        // R-X.3(b): a discard is replayed into the vault, which is never rolled back.
        if (this.metadata.pileDeposits) {
            this.revealsInfo = true
            commitHiddenOutputs(this, state)
        }
    }

    static chooserId(state: HydratedOathGameState): string | undefined {
        return state.campaign?.pendingDefeatKills?.chooserPlayerId
    }

    /** R-5.5.6 */
    static required(state: HydratedOathGameState): number {
        const campaign = state.campaign
        if (!campaign) return 0
        return HydratedCampaignSacrifice.requiredKills(state, campaign, campaign.defendingForce)
    }

    static reasonCannotChoose(
        state: HydratedOathGameState,
        playerId: string,
        kills: readonly WarbandGroup[]
    ): string | undefined {
        const campaign = state.campaign
        const chooserId = campaign?.pendingDefeatKills?.chooserPlayerId
        if (!campaign || chooserId === undefined) return 'no losses are waiting to be chosen'
        if (playerId !== chooserId) {
            return `${chooserId} chooses the defending side's losses (R-5.5.6.a)`
        }
        const required = HydratedCampaignDefeatKills.required(state)
        if (forceTotal(kills) !== required) {
            return `must kill exactly ${required} of the defeated force, not ${forceTotal(kills)}`
        }
        return selectionExceedsForce(kills, campaign.defendingForce)
    }

    static canDoCampaignDefeatKills(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedCampaignDefeatKills.chooserId(state) === playerId
    }
}
