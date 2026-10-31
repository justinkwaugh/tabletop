import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import type { PileDeposit } from '../model/hidden.js'
import type { HeldForHospital } from '../model/campaign.js'
import { endCampaign } from './campaignRoll.js'
import { afterCampaignPersistent } from './persistent.js'
import { orderTriggeredQuestions } from './questions.js'
import { endStepOutOfTurn, isCampaignOutOfTurn } from './sneakAttack.js'

/** Hospital — a step's record of the placements, none when nothing was placed. */
export function hospitalPlacedRecord(
    placed: readonly HeldForHospital[] | undefined
): HeldForHospital[] | undefined {
    return placed && placed.length > 0 ? [...placed] : undefined
}

export interface CampaignConclusion {
    notes: string[]
    /** R-5.5.8, R-9.4 */
    pileDeposits: PileDeposit[]
    /** Hospital — the warbands placed on its site at the end. */
    hospitalPlaced: HeldForHospital[]
    resumeMachineState?: MachineState
}

/** R-5.5.8's discards, then R-10.2's "after … campaign" powers in R-10.2-H1's order. */
export function concludeCampaign(state: HydratedOathGameState): CampaignConclusion {
    const campaign = state.campaign
    assertExists(campaign, 'Concluding a Campaign requires one in progress')
    const { attackerPlayerId, defenderPlayerId } = campaign
    const outOfTurn = isCampaignOutOfTurn(state)

    const { pileDeposits, hospitalPlaced } = endCampaign(state)
    const firstTriggered = state.pendingQuestions?.queue.length ?? 0
    const notes = afterCampaignPersistent(state, attackerPlayerId, defenderPlayerId)
    orderTriggeredQuestions(state, attackerPlayerId, firstTriggered)

    // Second Wind's free Travel and Campaign follow at once (revision 7), or the held turn resumes.
    const resumeMachineState = outOfTurn ? endStepOutOfTurn(state, attackerPlayerId) : undefined
    return { notes, pileDeposits, hospitalPlaced, resumeMachineState }
}
