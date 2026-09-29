import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import type { PileDeposit } from '../model/hidden.js'
import { endCampaign } from './campaignRoll.js'
import { afterCampaignPersistent } from './persistent.js'
import { forfeitFreeActions } from './freeActions.js'
import { orderTriggeredQuestions } from './questions.js'
import { isCampaignOutOfTurn, resumeHeldTurn } from './sneakAttack.js'

export interface CampaignConclusion {
    notes: string[]
    /** R-5.5.8, R-9.4 */
    pileDeposits: PileDeposit[]
    resumeMachineState?: MachineState
}

/** R-5.5.8's discards, then R-10.2's "after … campaign" powers in R-10.2-H1's order. */
export function concludeCampaign(state: HydratedOathGameState): CampaignConclusion {
    const campaign = state.campaign
    assertExists(campaign, 'Concluding a Campaign requires one in progress')
    const { attackerPlayerId, defenderPlayerId } = campaign
    const outOfTurn = isCampaignOutOfTurn(state)

    const pileDeposits = endCampaign(state)
    const firstTriggered = state.pendingQuestions?.queue.length ?? 0
    const notes = afterCampaignPersistent(state, attackerPlayerId, defenderPlayerId)
    orderTriggeredQuestions(state, attackerPlayerId, firstTriggered)

    // A free action granted out of turn has no Act Phase of its player's to be used in.
    if (outOfTurn) forfeitFreeActions(state, attackerPlayerId)
    return { notes, pileDeposits, resumeMachineState: resumeHeldTurn(state) }
}
