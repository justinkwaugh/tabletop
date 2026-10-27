import { assert } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { PowerMoveKind, PowerMoveTollOutcome, type PowerMoveToll } from '../model/powerMoveToll.js'
import {
    PowerQuestionKind,
    type QuestionOf,
    type ShroudedWoodPower,
    type ShroudedWoodTravel
} from '../model/question.js'
import { WHISTLE_ID } from '../data/relics.js'
import { burnHalfTheirFavor } from './burn.js'
import { usableFavor } from './favor.js'
import { pawnSiteId } from './pawn.js'
import { reasonPersistentForbidsGivingSecrets } from './persistent.js'
import { powerTravelFlipsNeeded, powerTravelNeedsFlip, travelByPower } from './powerTravel.js'
import {
    flipOfferedForTravel,
    flipSecretFacedown,
    secretsFlipped,
    travelFlipOf,
    type TravelFlip
} from './siteTravel.js'
import type { SiteFlip } from './hiddenInputs.js'
import { askQuestion } from './questions.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'
import { payToll, tollsFor, type Toll } from './tolls.js'

export type TollQuestion = QuestionOf<PowerQuestionKind.PayTravelToll>
export type FlipQuestion = QuestionOf<PowerQuestionKind.FlipToTravel>

/** A power's move of another player's pawn, as Toll Roads' question records it. */
export interface PowerMove {
    move: PowerMoveKind
    powerCardId?: string
    moverPlayerId: string
    movedPlayerId: string
    toSiteId: string
    burnFavor?: boolean
    /** R-11.7 — the Shrouded Wood's ruler picked for the traveller's own Travel. */
    travel?: ShroudedWoodTravel
    /** R-11.7-H1 — the Shrouded Wood's ruler picked for the Whistle's or the Brass Horse's move. */
    power?: ShroudedWoodPower
    /**
     * R-11.13-H1 — the moved player chose to flip a secret (`true`), or two (`2`, R-11.13-H2),
     * flipped once the move is certain.
     */
    flipSecret?: TravelFlip
}

/** What a power's move waits on: the moved player's flip, or Toll Roads' favor. */
export type PowerMoveWait = { kind: 'flip' } | { kind: 'toll'; tollMove: PowerMoveToll }

/**
 * Before a power moves another player's pawn, the moved player is asked what is theirs to give:
 * the flip The Hidden Place or the Buried Giant asks (R-11.13-H1), then Toll Roads' favor. A toll
 * they cannot pay blocks the move before any flip is asked. Undefined: nothing is asked, and the
 * caller moves the pawn.
 */
export function askBeforePowerMove(
    state: HydratedOathGameState,
    move: PowerMove,
    askingPlayerId: string
): PowerMoveWait | undefined {
    const toll = powerMoveToll(state, move.movedPlayerId, move.toSiteId)
    const tollPayable = toll === undefined || usableFavor(state, move.movedPlayerId) >= 1
    if (tollPayable && powerTravelNeedsFlip(state, move.movedPlayerId, move.toSiteId)) {
        askPowerMoveFlip(state, move, askingPlayerId)
        return { kind: 'flip' }
    }
    if (toll) return { kind: 'toll', tollMove: askPowerMoveToll(state, move, toll, askingPlayerId) }
    return undefined
}

/**
 * R-11.13-H1 — the question is the power's (the Whistle, Palanquin); a banish has no card, so it
 * names the site whose rule asks: the destination, or the Buried Giant left.
 */
function askPowerMoveFlip(state: HydratedOathGameState, move: PowerMove, askingPlayerId: string) {
    const fromSiteId = pawnSiteId(state, move.movedPlayerId)
    const asking =
        flipOfferedForTravel(state, fromSiteId, move.toSiteId) === 'demanded'
            ? move.toSiteId
            : fromSiteId
    // R-11.13-H2 — from the Buried Giant past a Narrow Pass into The Hidden Place, two.
    const flips = powerTravelFlipsNeeded(state, move.movedPlayerId, move.toSiteId)
    const forced = askQuestion(state, askingPlayerId, {
        kind: PowerQuestionKind.FlipToTravel,
        cardId: move.powerCardId ?? state.siteCardAt(asking) ?? asking,
        askedPlayerId: move.movedPlayerId,
        move: move.move,
        powerCardId: move.powerCardId,
        moverPlayerId: move.moverPlayerId,
        fromSiteId,
        siteId: move.toSiteId,
        ...(flips === 2 ? { flips } : {})
    })
    assert(forced === undefined, 'The flip is asked only of a player who can make it')
}

/**
 * The flip's yes: the toll follows, asked first among what waits, or the move happens. A banish's
 * burn waits in `banishPending`, so the toll does not carry it.
 */
export function settlePowerMoveFlip(
    state: HydratedOathGameState,
    question: FlipQuestion,
    askingPlayerId: string
): { tollMove: PowerMoveToll } | { arrived: PowerMoveArrival } {
    const move: PowerMove = {
        move: question.move,
        powerCardId: question.powerCardId,
        moverPlayerId: question.moverPlayerId,
        movedPlayerId: question.askedPlayerId,
        toSiteId: question.siteId,
        flipSecret: travelFlipOf(question.flips ?? 1)
    }
    const toll = powerMoveToll(state, move.movedPlayerId, move.toSiteId)
    if (toll) return { tollMove: askPowerMoveToll(state, move, toll, askingPlayerId, true) }
    return {
        arrived: completePowerMove(state, question, question.askedPlayerId, question.flips ?? 1)
    }
}

export interface PowerMoveArrival {
    notes: string[]
    revealed?: SiteFlip
    secretsTaken?: number
}

/** The fields a power's move is settled from, on Toll Roads' question or the flip's. */
interface SettledMove {
    move: PowerMoveKind
    moverPlayerId: string
    siteId: string
    power?: ShroudedWoodPower
}

/**
 * The move happens: the secrets the moved player chose to flip (R-11.13-H1), Palanquin's own pawn
 * ("Put your pawn on a site"), the travel and its after-travel powers, then the Whistle's secret.
 */
function completePowerMove(
    state: HydratedOathGameState,
    move: SettledMove,
    movedPlayerId: string,
    flips: number
): PowerMoveArrival {
    if (flips > 0) flipSecretFacedown(state, movedPlayerId, flips)
    if (move.move === PowerMoveKind.Palanquin) {
        state.getPlayerState(move.moverPlayerId).siteId = move.siteId
    }
    const { notes, revealed } = travelByPower(state, movedPlayerId, move.siteId, {
        playerId: move.moverPlayerId,
        next: true
    })
    const whistler = whistleUserOnArrival(state, move)
    const secretsTaken =
        whistler === undefined ? undefined : giveWhistleSecret(state, whistler, movedPlayerId)
    return { notes, revealed, secretsTaken }
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
            burnFavor: move.burnFavor,
            travel: move.travel,
            power: move.power,
            flipSecret: move.flipSecret
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

/**
 * The answer: paid, the move happens and the power finishes; refused, the pawn stays. A Travel out
 * of a Shrouded Wood pays the toll here, and its caller settles the Travel (`settleWoodPick`).
 */
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
        if (question.travel) return record
        const { notes, revealed, secretsTaken } = completePowerMove(
            state,
            question,
            moved,
            secretsFlipped(question.flipSecret)
        )
        assert(
            revealed === undefined,
            'Toll Roads asks only for a site its ruler rules, and a ruled site is faceup'
        )
        if (notes.length > 0) record.notes = notes
        if (secretsTaken !== undefined) record.secretsTaken = secretsTaken
    }
    // R-5.5.7.III — "make them travel … and you may burn half of their favor", in that order.
    if (question.burnFavor) record.favorBurned = burnHalfTheirFavor(state, moved)
    return record
}

/**
 * Whistle — "If they do, give them the [secret] here": the user, when the pulled pawn has just
 * arrived at the user's site. After the Shrouded Wood's ruler picked (R-11.7-H1), a pawn sent
 * elsewhere did not travel to the user's site, so nothing is given.
 */
export function whistleUserOnArrival(
    state: HydratedOathGameState,
    move: SettledMove
): string | undefined {
    if (move.move === PowerMoveKind.Whistle) return move.moverPlayerId
    const user = move.power?.powerCardId === WHISTLE_ID ? move.power.userPlayerId : undefined
    return user !== undefined && pawnSiteId(state, user) === move.siteId ? user : undefined
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
