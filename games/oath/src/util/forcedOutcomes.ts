import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import type { HydratedOathPlayerState } from '../model/playerState.js'
import { PowerQuestionKind, type PowerQuestion, type QuestionOf } from '../model/question.js'
import { CONSPIRACY_ID } from '../data/cardRegistry.js'
import { cardPowers } from '../data/cardPowers.js'
import { banksWithFavor, gainFavorFromBank, usableFavor } from './favor.js'
import { takeNotes, takeRelicsFrom } from './relics.js'
import { reasonExchangeInvalid } from './exchange.js'
import { playersAt } from './pawn.js'
import { reliquarySlot } from './imperial.js'
import { reasonCannotPayPowerCost } from './powerCost.js'
import { reasonPersistentForbidsRelicTake } from './persistent.js'
import { reasonCannotSneakAttack } from './campaign.js'

type ForcedOutcome<K extends PowerQuestionKind> = (
    state: HydratedOathGameState,
    question: QuestionOf<K>,
    asked: HydratedOathPlayerState
) => string | undefined

const FORCED_OUTCOMES: { [K in PowerQuestionKind]: ForcedOutcome<K> } = {
    [PowerQuestionKind.BurnFavorForSecrets]: (state, question) => {
        return usableFavor(state, question.askedPlayerId) <= 0
            ? `${question.askedPlayerId} has no favor to burn`
            : undefined
    },
    [PowerQuestionKind.PayOrLoseRelic]: (state, question, asked) => {
        if (!asked.relicIds.includes(question.relicCardId)) {
            return `${question.askedPlayerId} no longer holds ${question.relicCardId}`
        }
        if (usableFavor(state, question.askedPlayerId) >= question.price) return undefined
        const notes = takeRelicsFrom(state, question.askedPlayerId, question.takerPlayerId, [
            question.relicCardId
        ])
        return `${question.askedPlayerId} could not pay ${question.price} favor, so ${question.takerPlayerId} took ${question.relicCardId}${takeNotes(notes)}`
    },
    [PowerQuestionKind.PickFavorBank]: (state, question) => {
        const banks = banksWithFavor(state)
        if (banks.length > 1) return undefined
        if (banks.length === 0) return 'no favor bank has any favor to gain'
        const gained = gainFavorFromBank(state, question.askedPlayerId, banks[0], question.amount)
        return `${question.askedPlayerId} gained ${gained} favor from the ${banks[0]} bank, the only one with favor`
    },
    [PowerQuestionKind.Exchange]: (state, question) => {
        return reasonExchangeInvalid(
            state,
            question.proposerPlayerId,
            question.askedPlayerId,
            question.terms
        )
            ? `the proposed exchange can no longer be honoured: ${reasonExchangeInvalid(state, question.proposerPlayerId, question.askedPlayerId, question.terms)}`
            : undefined
    },
    [PowerQuestionKind.JoinSite]: (_state, question, asked) => {
        return asked.siteId === question.siteId
            ? `${question.askedPlayerId} is already there`
            : undefined
    },
    [PowerQuestionKind.GatheringFloor]: (state, question) => {
        return playersAt(state, question.siteId).filter((id) => id !== question.askedPlayerId)
            .length === 0
            ? 'nobody else is here to negotiate with'
            : undefined
    },
    [PowerQuestionKind.KeepOrBottomRelic]: () => undefined,
    [PowerQuestionKind.BottomRelic]: () => undefined,
    [PowerQuestionKind.TakeOrLeaveRelic]: (state, question) => {
        return reliquarySlot(state, question.slotId) !== undefined
            ? undefined
            : 'the Reliquary space is no longer occupied'
    },
    [PowerQuestionKind.PlayOrDiscardConspiracy]: (state, question) => {
        return state.getPlayerState(question.holderPlayerId).hasAdviser(CONSPIRACY_ID)
            ? undefined
            : 'the Conspiracy is no longer there'
    },
    [PowerQuestionKind.ShroudedWoodDestination]: () => undefined,
    [PowerQuestionKind.TravelFreeTo]: (_state, question) =>
        question.siteIds.length === 0 ? 'no site to travel to' : undefined,
    [PowerQuestionKind.RerollDice]: (state, question) => {
        const power = cardPowers(question.cardId)[question.powerIndex]
        assertExists(power, `${question.cardId} has a power at index ${question.powerIndex}`)
        const cost = reasonCannotPayPowerCost(state, question.askedPlayerId, power)
        return cost ? `${question.askedPlayerId} cannot use Jinx: ${cost}` : undefined
    },
    [PowerQuestionKind.RelicThiefRoll]: (state, question) => {
        const still = question.relicCardIds.filter((id) =>
            state.getPlayerState(question.takerPlayerId).relicIds.includes(id)
        )
        if (still.length === 0) return `${question.takerPlayerId} no longer holds the relics`
        // Circlet of Command, Lost Tongue — "cannot target or take … in any way".
        const forbidden = still
            .map((id) =>
                reasonPersistentForbidsRelicTake(
                    state,
                    question.askedPlayerId,
                    question.takerPlayerId,
                    id
                )
            )
            .find((reason) => reason !== undefined)
        if (forbidden) return `${question.askedPlayerId} cannot use Relic Thief: ${forbidden}`
        const power = cardPowers(question.cardId)[question.powerIndex]
        const cost = power
            ? reasonCannotPayPowerCost(state, question.askedPlayerId, power)
            : 'the power is not in play'
        return cost ? `${question.askedPlayerId} cannot use Relic Thief: ${cost}` : undefined
    },
    [PowerQuestionKind.PlayOrDiscardVision]: () => undefined,
    [PowerQuestionKind.DiscardInstead]: () => undefined,
    [PowerQuestionKind.SneakAttack]: (state, question) =>
        reasonCannotSneakAttack(state, question.askedPlayerId, question.defenderPlayerId),
    [PowerQuestionKind.OrderDiscards]: () => undefined,
    [PowerQuestionKind.OrderDrawnCards]: () => undefined,
    // Toll Roads — with no favor to give there is nothing to ask: the move is blocked.
    [PowerQuestionKind.PayTravelToll]: (state, question) =>
        usableFavor(state, question.askedPlayerId) < 1
            ? `${question.askedPlayerId} has no favor for ${question.cardId}`
            : undefined
}

function forcedOutcomeOf<K extends PowerQuestionKind>(
    state: HydratedOathGameState,
    kind: K,
    question: QuestionOf<K>
): string | undefined {
    const forced: ForcedOutcome<K> = FORCED_OUTCOMES[kind]
    return forced(state, question, state.getPlayerState(question.askedPlayerId))
}

export function forcedOutcome(
    state: HydratedOathGameState,
    question: PowerQuestion
): string | undefined {
    return forcedOutcomeOf(state, question.kind, question)
}
