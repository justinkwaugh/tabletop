import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import type { PileDeposit } from '../model/hidden.js'
import type { HeldForHospital } from '../model/campaign.js'
import { HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { phaseAfterActPhaseAction } from '../stateHandlers/handlerSupport.js'
import { burnHalfTheirFavor } from './burn.js'
import { concludeCampaign, hospitalPlacedRecord } from './campaignEnd.js'
import { isCampaignOutOfTurn } from './sneakAttack.js'

export interface VictoryConclusion {
    notes: string[]
    /** R-5.5.8, R-9.4 */
    pileDeposits: PileDeposit[]
    /** Hospital — the warbands placed on its site at the end. */
    hospitalPlaced: HeldForHospital[]
    /** Martial Culture */
    endsActPhase: boolean
    /** Sneak Attack — where the interrupted turn resumes. */
    resumeMachineState?: MachineState
}

/** R-5.5.8 — the victorious attacker's "if you're victorious" plans, after R-5.5.7; then the end. */
export function concludeVictory(state: HydratedOathGameState): VictoryConclusion {
    const campaign = state.campaign
    assertExists(campaign, 'Concluding a victory requires a Campaign in progress')
    const victoryPlans = HydratedCampaignSacrifice.runOutcomeHooks(
        state,
        campaign,
        true,
        (victorious) => victorious
    )
    // Martial Culture's "end your Act Phase" ends nothing for an attacker who is not in theirs.
    const endsActPhase = campaign.endsActPhaseAfter === true && !isCampaignOutOfTurn(state)
    const conclusion = concludeCampaign(state)
    return {
        notes: [...victoryPlans.notes, ...conclusion.notes],
        pileDeposits: [...victoryPlans.pileDeposits, ...conclusion.pileDeposits],
        hospitalPlaced: conclusion.hospitalPlaced,
        endsActPhase,
        resumeMachineState: conclusion.resumeMachineState
    }
}

export interface BanishedVictory {
    triggered?: string[]
    pileDeposits?: PileDeposit[]
    /** Hospital — the warbands placed on its site at the end. */
    hospitalPlaced?: HeldForHospital[]
    /** Where the turn goes once the questions are answered: where the Campaign's end leaves it. */
    resumeMachineState?: MachineState
}

/**
 * R-5.5.7.III, R-5.5.8 — the answer that settles a waiting banish (Toll Roads, the Shrouded Wood's
 * ruler): the burn kept for it, then the "if you're victorious" plans and the end. Nothing while no
 * banish waits.
 */
export function settleBanishedVictory(state: HydratedOathGameState): BanishedVictory {
    const campaign = state.campaign
    const pending = campaign?.banishPending
    if (!campaign || !pending) return {}
    campaign.banishPending = undefined
    const defenderId = campaign.defenderPlayerId
    assertExists(defenderId, 'Only a defender is banished')
    const favorBurned = pending.burnFavor ? burnHalfTheirFavor(state, defenderId) : 0
    const burned =
        favorBurned > 0 ? [`${campaign.attackerPlayerId} burned ${favorBurned} favor`] : []
    const done = concludeVictory(state)
    const resume = done.resumeMachineState ?? phaseAfterActPhaseAction(done)
    // The questions the end raised (Herald), and any left, resume the turn there too.
    if (state.pendingQuestions) state.pendingQuestions.resumeMachineState = resume
    const triggered = [...burned, ...done.notes]
    return {
        triggered: triggered.length > 0 ? triggered : undefined,
        pileDeposits: done.pileDeposits.length > 0 ? done.pileDeposits : undefined,
        hospitalPlaced: hospitalPlacedRecord(done.hospitalPlaced),
        resumeMachineState: resume
    }
}
