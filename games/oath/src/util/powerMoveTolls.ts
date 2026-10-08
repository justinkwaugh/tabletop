import { assert } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { PowerMoveKind, PowerMoveTollOutcome, type PowerMoveToll } from '../model/powerMoveToll.js'
import { PowerQuestionKind, type QuestionOf } from '../model/question.js'
import { WHISTLE_ID } from '../data/relics.js'
import { burnHalfTheirFavor } from './burn.js'
import { usableFavor } from './favor.js'
import { pawnSiteId } from './pawn.js'
import { reasonPersistentForbidsGivingSecrets } from './persistent.js'
import { travelByPower } from './powerTravel.js'
import { askQuestion } from './questions.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'
import { payToll, tollsFor, type Toll } from './tolls.js'

export type TollQuestion = QuestionOf<PowerQuestionKind.PayTravelToll>

/** A power's move of another player's pawn, as Toll Roads' question records it. */
export interface PowerMove {
    move: PowerMoveKind
    powerCardId?: string
    moverPlayerId: string
    movedPlayerId: string
    toSiteId: string
    burnFavor?: boolean
}

/** Toll Roads' Q&A — a move a power makes is travel, so the toll is owed (R-X.4: from this revision). */
export function powerMoveToll(
    state: HydratedOathGameState,
    movedPlayerId: string,
    toSiteId: string
): Toll | undefined {
    if (!isAtLeastOathRevision(state, OathRevision.UiBatch1)) return undefined
    const demanded = tollsFor(state, movedPlayerId, { kind: 'travel', toSiteId }).filter(
        (toll) => !toll.discount
    )
    assert(demanded.length <= 1, 'Toll Roads is the one card that demands a toll to travel')
    return demanded[0]
}

/** Brass Horse moves its own user, who pays as they go: a site they cannot pay for is out of reach. */
export function canPayPowerMoveToll(
    state: HydratedOathGameState,
    playerId: string,
    toSiteId: string
): boolean {
    return (
        powerMoveToll(state, playerId, toSiteId) === undefined || usableFavor(state, playerId) >= 1
    )
}

/** The moved player is asked; with no favor they are not, and the move is blocked. */
export function askPowerMoveToll(
    state: HydratedOathGameState,
    move: PowerMove,
    toll: Toll,
    askingPlayerId: string,
    front = false
): PowerMoveToll {
    const fromSiteId = pawnSiteId(state, move.movedPlayerId)
    const forced = askQuestion(
        state,
        askingPlayerId,
        {
            kind: PowerQuestionKind.PayTravelToll,
            cardId: toll.cardId,
            askedPlayerId: move.movedPlayerId,
            payeeId: toll.payeeId,
            move: move.move,
            powerCardId: move.powerCardId,
            moverPlayerId: move.moverPlayerId,
            fromSiteId,
            siteId: move.toSiteId,
            burnFavor: move.burnFavor
        },
        front
    )
    return {
        move: move.move,
        powerCardId: move.powerCardId,
        moverPlayerId: move.moverPlayerId,
        movedPlayerId: move.movedPlayerId,
        fromSiteId,
        toSiteId: move.toSiteId,
        toll: { cardId: toll.cardId, payeeId: toll.payeeId },
        outcome: forced === undefined ? PowerMoveTollOutcome.Asked : PowerMoveTollOutcome.NoFavor
    }
}

/** The answer: paid, the move happens and the power finishes; refused, the pawn stays. */
export function settlePowerMoveToll(
    state: HydratedOathGameState,
    question: TollQuestion,
    pay: boolean
): PowerMoveToll {
    const moved = question.askedPlayerId
    const record: PowerMoveToll = {
        move: question.move,
        powerCardId: question.powerCardId,
        moverPlayerId: question.moverPlayerId,
        movedPlayerId: moved,
        fromSiteId: question.fromSiteId,
        toSiteId: question.siteId,
        toll: { cardId: question.cardId, payeeId: question.payeeId },
        outcome: pay ? PowerMoveTollOutcome.Paid : PowerMoveTollOutcome.Refused
    }
    if (pay) {
        payToll(state, moved, record.toll)
        // Palanquin — "Put your pawn on a site", then "make them travel".
        if (question.move === PowerMoveKind.Palanquin) {
            state.getPlayerState(question.moverPlayerId).siteId = question.siteId
        }
        const { notes } = travelByPower(state, moved, question.siteId)
        if (notes.length > 0) record.notes = notes
        if (question.move === PowerMoveKind.Whistle) {
            record.secretsTaken = giveWhistleSecret(state, question.moverPlayerId, moved)
        }
    }
    // R-5.5.7.III — "make them travel … and you may burn half of their favor", in that order.
    if (question.burnFavor) record.favorBurned = burnHalfTheirFavor(state, moved)
    return record
}

/** Whistle — "If they do, give them the [secret] here"; Vow of Silence forbids the gift, not the pull. */
export function giveWhistleSecret(
    state: HydratedOathGameState,
    userId: string,
    movedPlayerId: string
): number {
    const silenced = reasonPersistentForbidsGivingSecrets(state, userId)
    const given = silenced ? 0 : Math.min(1, state.tokensOn(WHISTLE_ID).secrets)
    state.addTokensOn(WHISTLE_ID, { secrets: -given })
    state.getPlayerState(movedPlayerId).secrets += given
    return given
}
