import { assert, assertExists } from '@tabletop/common'
import { MachineState, type HydratedOathGameState } from '@tabletop/oath'

/** Whose turn the bar names and the turn's phase; who must act is the action panel's to say. */
export type TurnBar = {
    /** Absent in Setup, before R-4 starts the first turn. */
    playerId: string | undefined
    /** R-3.3 — between rounds the clock is the Chancellor's roll, not a turn. */
    roll: boolean
    /** Sneak Attack — a Campaign out of turn holds this turn. */
    paused: boolean
    phase: string
}

type Phase =
    | MachineState.Setup
    | MachineState.WakePhase
    | MachineState.ActPhase
    | MachineState.RestPhase
    | MachineState.EndOfRound
    | MachineState.EndOfGame

const PHASE_NAMES: Record<Exclude<Phase, MachineState.EndOfRound>, string> = {
    [MachineState.Setup]: 'Setup',
    [MachineState.WakePhase]: 'Wake Phase',
    [MachineState.ActPhase]: 'Act Phase',
    [MachineState.RestPhase]: 'Rest Phase',
    [MachineState.EndOfGame]: 'Game over'
}

type Step = { phase: Phase } | { resumes: MachineState }

function stepOf(state: HydratedOathGameState, at: MachineState): Step {
    switch (at) {
        case MachineState.Setup:
        case MachineState.WakePhase:
        case MachineState.ActPhase:
        case MachineState.RestPhase:
        case MachineState.EndOfRound:
        case MachineState.EndOfGame:
            return { phase: at }
        case MachineState.Searching:
        case MachineState.CampaignPlans:
        case MachineState.CampaignSkullLosses:
        case MachineState.CampaignSacrifice:
        case MachineState.CampaignDefeat:
        case MachineState.CampaignVictory:
            return { resumes: MachineState.ActPhase }
        case MachineState.ConsentRequest:
            // R-5.5.2.a's asks record no resume: they go on into the Campaign they hold.
            return { resumes: state.pendingConsent?.resumeMachineState ?? MachineState.ActPhase }
        case MachineState.PowerQuestion: {
            const pending = state.pendingQuestions
            assertExists(pending, 'A question is open')
            return { resumes: pending.resumeMachineState }
        }
        case MachineState.OathkeeperChoice: {
            const pending = state.pendingOathkeeperChoice
            assertExists(pending, 'An Oathkeeper choice is open')
            return { resumes: pending.resumeMachineState }
        }
    }
}

/** The phase the turn is in: each step the machine is in resumes the one it interrupted. */
function turnPhaseOf(state: HydratedOathGameState): Phase {
    const seen = new Set<MachineState>()
    let at = state.heldTurn?.resumeMachineState ?? state.machineState
    for (;;) {
        const step = stepOf(state, at)
        if ('phase' in step) return step.phase
        assert(!seen.has(at), `${at} resumes into itself`)
        seen.add(at)
        at = step.resumes
    }
}

export function turnBarOf(state: HydratedOathGameState): TurnBar {
    const phase = turnPhaseOf(state)
    if (phase === MachineState.EndOfRound) {
        return {
            playerId: state.chancellorId(),
            roll: true,
            paused: false,
            phase: `End of round ${state.round}`
        }
    }
    return {
        playerId: state.turnManager.currentTurn()?.playerId,
        roll: false,
        paused: state.heldTurn !== undefined,
        phase: PHASE_NAMES[phase]
    }
}
