import { HydratedOathGameState, discardRegionFor } from '../model/gameState.js'
import { SearchPlay } from '../model/oathEnums.js'
import type { AnswerOf, PowerQuestionKind } from '../model/question.js'
import { HydratedPlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { playCard, reasonCannotPlayCard } from './cardPlay.js'
import { regionOfPawn } from './pawn.js'
import {
    beginModifiersInUse,
    discardTargetOf,
    endModifiersInUse,
    modifierCardsInUse,
    payModifierCosts,
    type ActiveModifier
} from './modifiers.js'
import { modifierPayment, reasonCannotPayInAll, tollPayment } from './actionPayment.js'
import { payTolls, reasonTollsUnpaid, tollsFor, type Toll, type TollOccasion } from './tolls.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'
import type { AnswerOutcome } from './questionAnswers.js'

type VisionAnswer = AnswerOf<PowerQuestionKind.PlayOrDiscardVision>

// False Prophet: "play or discard the Vision as if you had searched", as Oracle's draw is played (R-6.1).
const AS_IF_SEARCHED: TollOccasion = { kind: 'asIfSearched' }

const NO_FAVOR = 'no favor for the toll: the Vision goes to the usual discard pile'

/**
 * R-6.1, R-7.4, R-7.1.4 — whether False Prophet's play or discard takes the Search modifiers that act on it (the
 * Cracked Horn, Bracken) and Forced Labor's toll: in a game created at revision 32 or later (R-X.4).
 */
export function falseProphetPlayAsSearched(state: HydratedOathGameState): boolean {
    return isAtLeastOathRevision(state, OathRevision.EngineFixes27)
}

/**
 * R-7.1.4 — the tolls the asked player owes for the play or discard, which they cannot decline (Forced Labor's
 * Q&A: "modifiers do apply"); none before revision 32.
 */
export function falseProphetTolls(state: HydratedOathGameState, playerId: string): Toll[] {
    if (!falseProphetPlayAsSearched(state)) return []
    return tollsFor(state, playerId, AS_IF_SEARCHED).filter((toll) => !toll.discount)
}

/**
 * The tolls the asked player cannot pay. Then the warband still dies and the Vision goes to the usual discard
 * pile: the plain discard is the one answer left, with no card in use and nothing paid. Empty when they can pay.
 */
export function falseProphetTollsUnpaid(state: HydratedOathGameState, playerId: string): string[] {
    const tolls = falseProphetTolls(state, playerId).map((toll) => toll.cardId)
    if (tolls.length === 0) return []
    return reasonTollsUnpaid(state, playerId, AS_IF_SEARCHED, tolls) === undefined ? [] : tolls
}

/**
 * R-6.1 — the modifiers acting on the play: those declared and the holder's mandatory ones, judged as a facedown
 * adviser's play judges its own. None before revision 32, and none on the plain discard left when a toll is unpaid.
 */
function modifiersOf(
    state: HydratedOathGameState,
    playerId: string,
    answer: VisionAnswer
): { reason?: string; active: ActiveModifier[] } {
    const declared = (answer.modifiers?.length ?? 0) > 0
    if (!falseProphetPlayAsSearched(state)) {
        return declared
            ? {
                  reason: 'in a game created before revision 32, no Search modifier applies to False Prophet’s play or discard',
                  active: []
              }
            : { active: [] }
    }
    if (falseProphetTollsUnpaid(state, playerId).length > 0) {
        return declared || answer.play !== SearchPlay.Discard
            ? { reason: NO_FAVOR, active: [] }
            : { active: [] }
    }
    return HydratedPlayFacedownAdviser.playModifiers(state, playerId, answer.play, answer.modifiers)
}

/** R-5.1.4 — the play or discard "as if you had searched", with its modifiers and tolls. */
export function reasonCannotPlayOrDiscardVision(
    state: HydratedOathGameState,
    playerId: string,
    visionCardId: string,
    answer: VisionAnswer
): string | undefined {
    const { reason, active } = modifiersOf(state, playerId, answer)
    if (reason) return reason
    const tolls =
        falseProphetTollsUnpaid(state, playerId).length > 0 ? [] : tollIds(state, playerId)
    return (
        reasonCannotPlayCard(state, playerId, visionCardId, answer.play, {
            faceUp: false,
            discardedAdviserCardIds: listOf(answer.discardedAdviserCardId),
            carried: active,
            modifiersInUse: modifierCardsInUse(state, active)
        }) ??
        // R-7.1.2 — the modifiers' costs and the tolls are paid from one holding.
        reasonCannotPayInAll(state, playerId, [modifierPayment(active), tollPayment(tolls)])
    )
}

/**
 * R-5.1.4 — "as if you had searched": the same play a Search's kept card gets, by the asked player, so a discard
 * goes to the usual pile of their own pawn's region (R-10.5) unless a modifier sends it elsewhere.
 */
export function playOrDiscardVision(
    state: HydratedOathGameState,
    playerId: string,
    visionCardId: string,
    answer: VisionAnswer
): AnswerOutcome {
    const { play } = answer
    const unpaid = falseProphetTollsUnpaid(state, playerId)
    const tolls = unpaid.length > 0 ? [] : tollIds(state, playerId)
    const { active } = modifiersOf(state, playerId, answer)
    const region = regionOfPawn(state, playerId)

    // R-7.4.3 — the cards the action under way keeps in use while its questions are open, this one among them.
    const queued = state.pendingQuestions?.searchModifiersInUse ?? []
    // R-7.1.2, R-7.4 — paid at declaration; R-7.4.3, not to be discarded until the play ends.
    payModifierCosts(state, playerId, active)
    beginModifiersInUse(state, active)
    const tollsPaid = payTolls(state, playerId, AS_IF_SEARCHED, tolls)
    const discardTarget = discardTargetOf(state, playerId, active)
    const played = playCard(state, playerId, visionCardId, play, region, {
        faceUp: false,
        // The Vision was revealed; played facedown, the table still knows it.
        seen: true,
        discardedAdviserCardIds: listOf(answer.discardedAdviserCardId),
        carried: active,
        discardTarget
    })
    endModifiersInUse(state)
    // A question this play asked keeps its cards in use beside those the action under way already kept.
    const pending = state.pendingQuestions
    if (pending && queued.length > 0)
        pending.searchModifiersInUse = [
            ...new Set([...queued, ...(pending.searchModifiersInUse ?? [])])
        ]

    const summary =
        play === SearchPlay.Discard
            ? `discarded ${visionCardId}`
            : `played ${visionCardId} (${play})`
    return {
        summary,
        ...(played.discarded.length > 0
            ? {
                  discardedCardIds: played.discarded,
                  discardPileRegion: discardTarget?.region ?? discardRegionFor(region),
                  discardToBottom: discardTarget?.bottom || undefined,
                  discardToWorldDeck: discardTarget?.worldDeck || undefined
              }
            : {}),
        ...(active.length > 0 ? { modifiers: active.map((m) => m.power.cardId) } : {}),
        ...(tollsPaid.length > 0 ? { tollsPaid } : {}),
        ...(unpaid.length > 0 ? { tollsUnpaid: unpaid } : {})
    }
}

function tollIds(state: HydratedOathGameState, playerId: string): string[] {
    return falseProphetTolls(state, playerId).map((toll) => toll.cardId)
}

function listOf(id: string | undefined): string[] {
    return id === undefined ? [] : [id]
}
