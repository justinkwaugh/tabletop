import { assert, assertExists } from '@tabletop/common'
import { HydratedOathGameState, type ProjectedPowerQuestion } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { PowerQuestionKind } from '../model/question.js'
import { askQuestion, currentQuestion, resumeStateAfterQuestions } from './questions.js'
import { forfeitFreeActions, nextActionIndex, SECOND_WIND_ID } from './freeActions.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'

export type FreeActionOutOfTurn = ActionType.Travel | ActionType.Campaign

export function sneakAttackOfferedTo(state: HydratedOathGameState, playerId: string) {
    const question = currentQuestion(state)
    return question?.kind === PowerQuestionKind.SneakAttack && question.askedPlayerId === playerId
        ? question
        : undefined
}

/** Second Wind out of turn (revision 7) — the free Travel or Campaign asked of `playerId` now. */
export function freeActionOutOfTurnOfferedTo(
    state: HydratedOathGameState,
    playerId: string,
    action: FreeActionOutOfTurn
) {
    const question = currentQuestion(state)
    return question?.kind === PowerQuestionKind.FreeActionOutOfTurn &&
        question.askedPlayerId === playerId &&
        question.action === action
        ? question
        : undefined
}

export function holdTurnForSneakAttack(state: HydratedOathGameState, playerId: string): void {
    assert(
        sneakAttackOfferedTo(state, playerId) !== undefined,
        `no Sneak Attack is offered to ${playerId}`
    )
    holdTurn(state, takeCurrentQuestion(state))
}

export function holdTurnForFreeActionOutOfTurn(
    state: HydratedOathGameState,
    playerId: string,
    action: FreeActionOutOfTurn
): void {
    assert(
        freeActionOutOfTurnOfferedTo(state, playerId, action) !== undefined,
        `no free ${action} out of turn is offered to ${playerId}`
    )
    holdTurn(state, takeCurrentQuestion(state))
}

/** The skip has already taken its question off the queue; the turn stays held while the chain goes on. */
export function holdTurnForSkippedFreeAction(state: HydratedOathGameState): void {
    const pending = state.pendingQuestions
    assertExists(pending, 'a skip is an answer, so a question was open')
    holdTurn(state, pending.queue)
}

function takeCurrentQuestion(state: HydratedOathGameState): ProjectedPowerQuestion[] {
    const pending = state.pendingQuestions
    assertExists(pending, 'an action out of turn was taken with no question open')
    return pending.queue.slice(1)
}

/**
 * The questions behind the one taken wait with the turn. There is one held turn: a step out of turn taken
 * while one is held (Second Wind's free Travel, Campaign or skip) puts what waits behind it ahead of the
 * held turn's own questions, so held turns never stack.
 */
function holdTurn(state: HydratedOathGameState, waiting: ProjectedPowerQuestion[]): void {
    const pending = state.pendingQuestions
    assertExists(pending, 'the turn is held from an open question')
    const held = state.heldTurn
    if (held) {
        assert(pending.followUp === undefined, 'no follow-up is built while a turn is held')
        state.heldTurn = { ...held, queue: [...waiting, ...held.queue] }
    } else {
        state.heldTurn = {
            ...pending,
            queue: waiting,
            resumeMachineState: resumeStateAfterQuestions(state)
        }
    }
    state.pendingQuestions = undefined
}

export function isCampaignOutOfTurn(state: HydratedOathGameState): boolean {
    return state.heldTurn !== undefined
}

/** The Campaign's own questions are asked before the held turn's. */
export function resumeHeldTurn(state: HydratedOathGameState): MachineState | undefined {
    const held = state.heldTurn
    if (!held) return undefined
    state.heldTurn = undefined
    const queue = [...(state.pendingQuestions?.queue ?? []), ...held.queue]
    state.pendingQuestions = queue.length > 0 || held.followUp ? { ...held, queue } : undefined
    return held.resumeMachineState
}

/**
 * After a step out of turn: from revision 7 its player's free Travel, then free Campaign (Second Wind's "you
 * may travel and then may campaign"), is asked while the turn stays held, after the step's own questions
 * (Sneak Attack's Q&A: "Resolve Sneak Attack first, then Second Wind"). Otherwise the held turn resumes, and
 * a free action still granted is forfeit: its player has no Act Phase to use it in (R-X.4: before revision 7,
 * the grant is lost).
 */
export function endStepOutOfTurn(state: HydratedOathGameState, playerId: string): MachineState {
    const held = state.heldTurn
    assertExists(held, 'a step out of turn holds the turn')
    if (
        isAtLeastOathRevision(state, OathRevision.EngineFixes3) &&
        askFreeActionOutOfTurn(state, playerId, held.resumeMachineState)
    ) {
        return held.resumeMachineState
    }
    forfeitFreeActions(state, playerId)
    const resume = resumeHeldTurn(state)
    assertExists(resume, 'the held turn names where it resumes')
    return resume
}

/**
 * A grant is made for the next action (`nextActionIndex`), so that one is asked. One its holder cannot take is
 * given up unasked, and the next is asked in its place.
 */
function askFreeActionOutOfTurn(
    state: HydratedOathGameState,
    playerId: string,
    resumeMachineState: MachineState
): boolean {
    const player = state.getPlayerState(playerId)
    const next = nextActionIndex(state)
    const action =
        player.freeTravelAtAction === next
            ? ActionType.Travel
            : player.freeCampaignAtAction === next
              ? ActionType.Campaign
              : undefined
    if (action === undefined) return false
    const forgone = askQuestion(state, playerId, {
        kind: PowerQuestionKind.FreeActionOutOfTurn,
        cardId: SECOND_WIND_ID,
        askedPlayerId: playerId,
        action
    })
    if (forgone !== undefined) return askFreeActionOutOfTurn(state, playerId, resumeMachineState)
    const pending = state.pendingQuestions
    assertExists(pending, 'the free action was just asked')
    // The chain's questions end where the held turn resumes.
    pending.resumeMachineState = resumeMachineState
    return true
}
