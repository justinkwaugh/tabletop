import { assert, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { PowerQuestionKind } from '../model/question.js'
import { currentQuestion, resumeStateAfterQuestions } from './questions.js'

export function sneakAttackOfferedTo(state: HydratedOathGameState, playerId: string) {
    const question = currentQuestion(state)
    return question?.kind === PowerQuestionKind.SneakAttack && question.askedPlayerId === playerId
        ? question
        : undefined
}

export function holdTurnForSneakAttack(state: HydratedOathGameState, playerId: string): void {
    const pending = state.pendingQuestions
    assertExists(pending, 'a Sneak Attack was taken with no question open')
    assert(
        sneakAttackOfferedTo(state, playerId) !== undefined,
        `no Sneak Attack is offered to ${playerId}`
    )
    assert(state.heldTurn === undefined, 'a Campaign out of turn is already under way')
    state.heldTurn = {
        ...pending,
        queue: pending.queue.slice(1),
        resumeMachineState: resumeStateAfterQuestions(state)
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
