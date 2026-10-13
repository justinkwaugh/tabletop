import {
    HydratedAnswerQuestion,
    type CardKind,
    PowerQuestionKind,
    SearchPlay,
    type HydratedOathGameState,
    type QuestionAnswer
} from '@tabletop/oath'
import { adviserRowText, cardName } from './names.js'
import { adviserBack } from './cardBacks.js'

export function playVisionAnswer(
    play: SearchPlay,
    discardedAdviserCardId?: string
): QuestionAnswer {
    return {
        kind: PowerQuestionKind.PlayOrDiscardVision,
        play,
        ...(discardedAdviserCardId !== undefined ? { discardedAdviserCardId } : {})
    }
}

// R-5.1.4-H1 — Inquisitor's finder plays the Conspiracy facedown to their advisers.
export function conspiracyFacedownAnswer(discardedAdviserCardId?: string): QuestionAnswer {
    return {
        kind: PowerQuestionKind.PlayOrDiscardConspiracy,
        play: true,
        facedown: true,
        ...(discardedAdviserCardId !== undefined ? { discardedAdviserCardId } : {})
    }
}

// Law Glossary "Discard" — the cards go down in the order given, the last on top. The answer
// names positions, not cards, because every player receives its record.
export function stackOrderAnswer(
    kind: PowerQuestionKind.OrderDrawnCards | PowerQuestionKind.OrderDiscards,
    cardIds: readonly string[],
    stackOrder: readonly string[]
): QuestionAnswer {
    const order = stackOrder.map((cardId) => cardIds.indexOf(cardId))
    return kind === PowerQuestionKind.OrderDiscards
        ? { kind: PowerQuestionKind.OrderDiscards, order }
        : { kind: PowerQuestionKind.OrderDrawnCards, order }
}

// R-5.1.4.II — at the adviser limit a Vision goes facedown only over a discarded adviser.
export function advisersToDiscardForVision(
    state: HydratedOathGameState,
    playerId: string
): string[] {
    const reasonFor = (answer: QuestionAnswer) =>
        HydratedAnswerQuestion.reasonCannotAnswer(state, playerId, answer)
    if (reasonFor(playVisionAnswer(SearchPlay.Adviser)) === undefined) return []
    return state
        .getPlayerState(playerId)
        .knownAdviserIds()
        .filter((cardId) => reasonFor(playVisionAnswer(SearchPlay.Adviser, cardId)) === undefined)
}

// R-5.1.4.II — at the adviser limit the Conspiracy goes facedown only over a discarded adviser.
export function advisersToDiscardForConspiracy(
    state: HydratedOathGameState,
    playerId: string
): string[] {
    const reasonFor = (answer: QuestionAnswer) =>
        HydratedAnswerQuestion.reasonCannotAnswer(state, playerId, answer)
    if (reasonFor(conspiracyFacedownAnswer()) === undefined) return []
    return state
        .getPlayerState(playerId)
        .knownAdviserIds()
        .filter((cardId) => reasonFor(conspiracyFacedownAnswer(cardId)) === undefined)
}

export type AdviserRowOffer = { row: number; label: string; cardId?: string; back: CardKind }

/** R-9.4 — every adviser row may be offered; a facedown card is named only to the viewer who holds it. */
export function offerableAdviserRows(
    state: HydratedOathGameState,
    giverId: string,
    viewerId: string | undefined
): AdviserRowOffer[] {
    const giver = state.getPlayerState(giverId)
    const known = giverId === viewerId ? giver.knownAdvisers() : []
    return giver.advisers.map((adviser, row) => {
        const own = known[row]
        if (own) {
            return {
                row,
                cardId: own.cardId,
                back: adviserBack(adviser),
                label: `${cardName(own.cardId)}${own.faceUp ? '' : ' (facedown)'}`
            }
        }
        return {
            row,
            cardId: adviser.cardId,
            back: adviserBack(adviser),
            label: adviserRowText(state, giverId, row)
        }
    })
}
