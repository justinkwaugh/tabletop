import { HydratedOathGameState } from '../model/gameState.js'
import type { PileDeposit } from '../model/hidden.js'
import type { Region } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import {
    detachFromPlay,
    discardCards,
    isInPlay,
    noteSiteDiscard,
    regionCardLeavesFrom
} from './discard.js'
import { askQuestion } from './questions.js'

/**
 * Law Glossary "Discard" — "place the prompted cards in an order of your choice": cards leaving
 * play for one pile go at once when there is one, and wait for the discarder's order when there
 * are more.
 */
export function discardFromPlayInChosenOrder(
    state: HydratedOathGameState,
    actingPlayerId: string,
    cardIds: readonly string[],
    /** The power that prompts the discard; absent when the cards discard themselves (R-5.5.8). */
    sourceCardId?: string
): PileDeposit[] {
    const byRegion = new Map<Region, string[]>()
    for (const cardId of cardIds) {
        if (!isInPlay(state, cardId)) continue
        const fromRegion = regionCardLeavesFrom(state, cardId)
        noteSiteDiscard(state, actingPlayerId, cardId)
        detachFromPlay(state, cardId)
        byRegion.set(fromRegion, [...(byRegion.get(fromRegion) ?? []), cardId])
    }
    const deposits: PileDeposit[] = []
    for (const [fromRegion, going] of byRegion) {
        if (going.length === 1) {
            deposits.push(...discardCards(state, actingPlayerId, going, fromRegion))
            continue
        }
        askQuestion(state, actingPlayerId, {
            kind: PowerQuestionKind.OrderDiscards,
            cardId: sourceCardId ?? going[0],
            askedPlayerId: actingPlayerId,
            cardIds: going,
            fromRegion
        })
    }
    return deposits
}
