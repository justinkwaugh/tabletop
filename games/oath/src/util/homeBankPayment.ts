import { HydratedOathGameState } from '../model/gameState.js'
import { PowerQuestionKind, type QuestionOf } from '../model/question.js'
import type { Suit } from '../model/oathEnums.js'
import { assertExists } from '@tabletop/common'
import { favorHomeBankOf, homeBankPayable, spendFavor, usableFavor } from './favor.js'
import { askQuestion, turnOrderFrom } from './questions.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'
import { isInPlay } from './discard.js'
import { suitOf } from '../data/cardRegistry.js'

export type PayFromHomeBankQuestion = QuestionOf<PowerQuestionKind.PayFromHomeBank>

/**
 * Vow of Kinship's Q&A — "You can use Nomad favor as if it is on your board, but you are not forced
 * to" (R-10.10-H1): favor a power makes a player place comes off their board alone, and the bank only
 * as they choose. Before revision 18 the bank paid too, unasked (R-X.4).
 */
function forcedFavorOf(state: HydratedOathGameState, playerId: string): number {
    return isAtLeastOathRevision(state, OathRevision.EngineFixes14)
        ? state.getPlayerState(playerId).favor
        : usableFavor(state, playerId)
}

/** R-7.1.3 — as much of `owed` as the player must pay; returns what they paid. */
export function payOwedFavor(state: HydratedOathGameState, playerId: string, owed: number): number {
    const paid = Math.min(owed, forcedFavorOf(state, playerId))
    spendFavor(state, playerId, paid)
    return paid
}

/**
 * Each player whose board left some of `unpaid` owing and whose bank holds favor is asked, in turn
 * order from the Chancellor as Revelation's round goes (only one Vow of Kinship exists, so in play
 * one seat at most).
 */
export function askRestFromHomeBanks(
    state: HydratedOathGameState,
    askingPlayerId: string,
    cardId: string,
    unpaid: ReadonlyMap<string, number>,
    toBank?: Suit
): void {
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes14)) return
    for (const playerId of turnOrderFrom(state, state.chancellorId())) {
        const owed = unpaid.get(playerId) ?? 0
        if (owed <= 0 || homeBankPayable(state, playerId, owed) <= 0) continue
        const question: PayFromHomeBankQuestion = {
            kind: PowerQuestionKind.PayFromHomeBank,
            cardId,
            askedPlayerId: playerId,
            owed,
            ...(toBank === undefined ? {} : { toBank })
        }
        askQuestion(state, askingPlayerId, question)
    }
}

export function reasonCannotPayFromHomeBank(
    state: HydratedOathGameState,
    question: PayFromHomeBankQuestion,
    favor: number
): string | undefined {
    if (!Number.isInteger(favor) || favor < 0) return 'the favor to pay must be a whole number'
    if (favor > question.owed) return `you owe ${question.owed} favor, not ${favor}`
    const payable = homeBankPayable(state, question.askedPlayerId, question.owed)
    if (favor > payable) return `your bank holds ${payable} favor you can pay, not ${favor}`
    return undefined
}

/**
 * Where the answer's favor goes: the power's bank, or its card. R-10.5 — a card discarded before
 * the answer (Land Warden's second card can discard Dissent) has already sent its favor to the bank
 * of its suit, so the payment goes there too.
 */
function payeeBankOf(
    state: HydratedOathGameState,
    question: PayFromHomeBankQuestion
): Suit | undefined {
    if (question.toBank !== undefined) return question.toBank
    if (isInPlay(state, question.cardId)) return undefined
    const suit = suitOf(question.cardId)
    assertExists(suit, `${question.cardId} has no suit, so its favor has no bank`)
    return suit
}

/** The answer: `favor` from the asked player's bank into the power's bank or onto its card. */
export function payFromHomeBank(
    state: HydratedOathGameState,
    question: PayFromHomeBankQuestion,
    favor: number
): string {
    if (favor === 0) return 'paid no favor'
    const bank = favorHomeBankOf(state, question.askedPlayerId)
    assertExists(bank, `${question.askedPlayerId} has no bank to pay from`)
    state.favorBank[bank] -= favor
    const toBank = payeeBankOf(state, question)
    if (toBank === undefined) {
        state.addTokensOn(question.cardId, { favor })
        return `paid ${favor} favor from the ${bank} bank onto it`
    }
    state.favorBank[toBank] += favor
    return `paid ${favor} favor from the ${bank} bank into the ${toBank} bank`
}
