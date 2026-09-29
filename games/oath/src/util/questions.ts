import { assert, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { Suit, Region } from '../model/oathEnums.js'
import { MachineState } from '../definition/states.js'
import { PowerQuestionKind, type PowerQuestion, type QuestionAnswer } from '../model/question.js'
import { settleSkullKills } from './campaignRoll.js'
import type { PileDeposit } from '../model/hidden.js'
import type { HydratedOathPlayerState } from '../model/playerState.js'
import { QUESTION_RULES } from './questionRules.js'

export type QuestionOf<K extends PowerQuestionKind> = Extract<PowerQuestion, { kind: K }>
export type AnswerOf<K extends PowerQuestionKind> = Extract<QuestionAnswer, { kind: K }>
export type Answered<K extends PowerQuestionKind> = { question: QuestionOf<K>; answer: AnswerOf<K> }

export interface QuestionRules<K extends PowerQuestionKind> {
    forcedOutcome(
        state: HydratedOathGameState,
        question: QuestionOf<K>,
        asked: HydratedOathPlayerState
    ): string | undefined
    reasonCannotAnswer(
        state: HydratedOathGameState,
        playerId: string,
        matched: Answered<K>
    ): string | undefined
    apply(
        state: HydratedOathGameState,
        playerId: string,
        matched: Answered<K>,
        asked: HydratedOathPlayerState,
        askingPlayerId: string
    ): string | AnswerOutcome
}

function rulesOf<K extends PowerQuestionKind>(kind: K): QuestionRules<K> {
    return QUESTION_RULES[kind]
}

function answerMatches<K extends PowerQuestionKind>(
    kind: K,
    answer: QuestionAnswer
): answer is AnswerOf<K> {
    return answer.kind === kind
}

function forcedOutcomeOf<K extends PowerQuestionKind>(
    state: HydratedOathGameState,
    kind: K,
    question: QuestionOf<K>
): string | undefined {
    return rulesOf(kind).forcedOutcome(
        state,
        question,
        state.getPlayerState(question.askedPlayerId)
    )
}

function reasonCannotAnswerOf<K extends PowerQuestionKind>(
    state: HydratedOathGameState,
    playerId: string,
    kind: K,
    question: QuestionOf<K>,
    answer: QuestionAnswer
): string | undefined {
    if (!answerMatches(kind, answer)) return `the question is ${kind}, not ${answer.kind}`
    return rulesOf(kind).reasonCannotAnswer(state, playerId, { question, answer })
}

function applyAnswerOf<K extends PowerQuestionKind>(
    state: HydratedOathGameState,
    playerId: string,
    kind: K,
    question: QuestionOf<K>,
    answer: QuestionAnswer,
    askingPlayerId: string
): string | AnswerOutcome {
    assert(answerMatches(kind, answer), `the question is ${kind}, not ${answer.kind}`)
    return rulesOf(kind).apply(
        state,
        playerId,
        { question, answer },
        state.getPlayerState(playerId),
        askingPlayerId
    )
}

export function turnOrderFrom(state: HydratedOathGameState, fromPlayerId: string): string[] {
    const order = state.turnManager.turnOrder
    const start = order.indexOf(fromPlayerId)
    if (start < 0) return [...order]
    return [...order.slice(start), ...order.slice(0, start)]
}

export function banksWithFavor(state: HydratedOathGameState): Suit[] {
    return Object.values(Suit).filter((suit) => state.favorBank[suit] > 0)
}

function forcedOutcome(state: HydratedOathGameState, question: PowerQuestion): string | undefined {
    return forcedOutcomeOf(state, question.kind, question)
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

export function currentQuestion(state: HydratedOathGameState): PowerQuestion | undefined {
    return state.pendingQuestions?.queue[0]
}

export function playersAt(state: HydratedOathGameState, siteId: string): string[] {
    return state.players.filter((p) => p.siteId === siteId).map((p) => p.playerId)
}

export function settleQueue(state: HydratedOathGameState): boolean {
    const pending = state.pendingQuestions
    if (!pending) return true
    // Jinx — the skulls' kills are held back until every reroll is answered.
    if (pending.queue.length === 0 && !pending.followUp) settleSkullKills(state)
    if (pending.queue.length === 0 && pending.followUp) {
        const { cardId, siteId } = pending.followUp
        pending.followUp = undefined
        // R-7.6.3-H2 — each present player, in turn order, may propose one exchange.
        for (const playerId of turnOrderFrom(state, pending.askingPlayerId)) {
            if (state.getPlayerState(playerId).siteId !== siteId) continue
            askQuestion(state, pending.askingPlayerId, {
                kind: PowerQuestionKind.GatheringFloor,
                cardId,
                askedPlayerId: playerId,
                siteId
            })
        }
    }
    return pending.queue.length === 0
}

export function reasonCannotAnswer(
    state: HydratedOathGameState,
    playerId: string,
    answer: QuestionAnswer
): string | undefined {
    const question = currentQuestion(state)
    if (!question) return 'no question is waiting for an answer'
    if (question.askedPlayerId !== playerId)
        return `the question is ${question.askedPlayerId}'s to answer`
    return reasonCannotAnswerOf(state, playerId, question.kind, question, answer)
}

export interface AnswerOutcome {
    summary: string
    relicToDeckBottom?: string
    /** R-X.3 */
    rolled?: boolean
    /** R-10.5 */
    discardedCardIds?: string[]
    discardPileRegion?: Region
    /** R-10.5 */
    pileDeposits?: PileDeposit[]
    /** Skeleton Key */
    relicTakenFromSlotId?: string
    /** R-X.3(c) */
    disclosed?: boolean
}

export function applyAnswer(
    state: HydratedOathGameState,
    playerId: string,
    answer: QuestionAnswer
): AnswerOutcome {
    const outcome = applyAnswerInner(state, playerId, answer)
    return typeof outcome === 'string' ? { summary: outcome } : outcome
}

function applyAnswerInner(
    state: HydratedOathGameState,
    playerId: string,
    answer: QuestionAnswer
): string | AnswerOutcome {
    const reason = reasonCannotAnswer(state, playerId, answer)
    if (reason) throw Error(`Cannot answer: ${reason}`)
    const pending = state.pendingQuestions
    assertExists(pending, 'an answer was validated with no pending questions')
    const head = pending.queue.shift()
    assertExists(head, 'an answer was validated with an empty question queue')
    return applyAnswerOf(state, playerId, head.kind, head, answer, pending.askingPlayerId)
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
