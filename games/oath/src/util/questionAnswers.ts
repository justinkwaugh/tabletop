import { assert, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { Region } from '../model/oathEnums.js'
import {
    PowerQuestionKind,
    PowerQuestionValidator,
    type Answered,
    type AnswerOf,
    type QuestionAnswer,
    type QuestionOf,
    type ShroudedWoodPick
} from '../model/question.js'
import type { PileDeposit } from '../model/hidden.js'
import type { HydratedOathPlayerState } from '../model/playerState.js'
import { settleSkullKills } from './campaignRoll.js'
import { askQuestion, currentQuestion, gatheringTurnOrder } from './questions.js'
import { QUESTION_RULES } from './questionRules.js'

export interface QuestionRules<K extends PowerQuestionKind> {
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
    /** R-11.7 */
    woodPick?: ShroudedWoodPick
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

export function settleQueue(state: HydratedOathGameState): boolean {
    const pending = state.pendingQuestions
    if (!pending) return true
    // Jinx — the skulls' kills are held back until every reroll is answered.
    if (pending.queue.length === 0 && !pending.followUp) settleSkullKills(state)
    if (pending.queue.length === 0 && pending.followUp) {
        const { cardId, siteId } = pending.followUp
        pending.followUp = undefined
        // R-7.6.3-H2 — each present player, in turn order, may propose one exchange.
        for (const playerId of gatheringTurnOrder(state, pending.askingPlayerId)) {
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
    // R-9.4 — only the asked player's view and the host's carry the question's protected fields.
    if (!PowerQuestionValidator.Check(question))
        return 'the question’s hidden fields are not known in this view'
    return reasonCannotAnswerOf(state, playerId, question.kind, question, answer)
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
    assert(
        PowerQuestionValidator.Check(head),
        'Answering needs the question as its asked player or the host sees it'
    )
    return applyAnswerOf(state, playerId, head.kind, head, answer, pending.askingPlayerId)
}
