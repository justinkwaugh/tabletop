import { assertExists } from '@tabletop/common'
import { HydratedOathGameState, type ProjectedPowerQuestion } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import type { PowerQuestion } from '../model/question.js'
import { forcedOutcome } from './forcedOutcomes.js'

export function turnOrderFrom(state: HydratedOathGameState, fromPlayerId: string): string[] {
    const order = state.turnManager.turnOrder
    const start = order.indexOf(fromPlayerId)
    if (start < 0) return [...order]
    return [...order.slice(start), ...order.slice(0, start)]
}

export function askQuestion(
    state: HydratedOathGameState,
    askingPlayerId: string,
    question: PowerQuestion,
    front = false
): string | undefined {
    const forced = forcedOutcome(state, question)
    if (forced) return forced
    const pending = state.pendingQuestions ?? {
        queue: [],
        askingPlayerId,
        resumeMachineState: state.machineState
    }
    if (front) pending.queue.unshift(question)
    else pending.queue.push(question)
    state.pendingQuestions = pending
    return undefined
}

export function scheduleGatheringFloor(
    state: HydratedOathGameState,
    askingPlayerId: string,
    cardId: string,
    siteId: string
): void {
    const pending = state.pendingQuestions ?? {
        queue: [],
        askingPlayerId,
        resumeMachineState: state.machineState
    }
    pending.followUp = { kind: 'gatheringFloor', cardId, siteId }
    state.pendingQuestions = pending
}

export function currentQuestion(state: HydratedOathGameState): ProjectedPowerQuestion | undefined {
    return state.pendingQuestions?.queue[0]
}

export function resumeStateAfterQuestions(state: HydratedOathGameState): MachineState {
    const pending = state.pendingQuestions
    assertExists(pending, 'No question is open')
    return pending.resumeMachineState
}

/** R-10.2-H1 — questions raised at the same moment: the acting player's first, then clockwise from them. */
export function orderTriggeredQuestions(
    state: HydratedOathGameState,
    actingPlayerId: string,
    firstTriggeredIndex: number
): void {
    const pending = state.pendingQuestions
    if (!pending) return
    const seats = turnOrderFrom(state, actingPlayerId)
    const triggered = pending.queue
        .slice(firstTriggeredIndex)
        .sort((a, b) => seats.indexOf(a.askedPlayerId) - seats.indexOf(b.askedPlayerId))
    pending.queue = [...pending.queue.slice(0, firstTriggeredIndex), ...triggered]
}
