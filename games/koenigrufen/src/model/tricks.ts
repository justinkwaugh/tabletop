import * as Type from 'typebox'
import { assert } from '@tabletop/common'
import {
    card,
    CardIdSchema,
    isTrump,
    Pagat,
    suitOf,
    trumpId,
    type Card
} from '../components/cards.js'
import { Goal, type ContractDefinition } from '../components/contracts.js'

export type TrickPlay = Type.Static<typeof TrickPlay>
export const TrickPlay = Type.Object({
    playerId: Type.String(),
    cardId: CardIdSchema
})

export type Trick = Type.Static<typeof Trick>
export const Trick = Type.Object({
    leaderId: Type.String(),
    plays: Type.Array(TrickPlay)
})

export type CompletedTrick = Type.Static<typeof CompletedTrick>
export const CompletedTrick = Type.Object({
    plays: Type.Array(TrickPlay),
    winnerId: Type.String()
})

export const TricksPerHand = 12

// How the contract changes trick play.
export type PlayRules = {
    // Colour games (Farbensolo, Farbendreier) set this false: trumps do not beat the suit led, may
    // not be led while the leader holds a suit card, and are held back while suit cards remain.
    readonly trumpsWin: boolean
    // Negative games and Trischaken: beat the highest card so far if possible, and play the Pagat
    // only as your last trump.
    readonly mustBeat: boolean
}

export const OrdinaryPlay: PlayRules = { trumpsWin: true, mustBeat: false }

export function playRules(definition: ContractDefinition): PlayRules {
    return {
        trumpsWin: definition.trumpsWin,
        mustBeat: definition.goal !== Goal.TakePoints
    }
}

// Follow suit; without the suit led, play a trump; only then anything. The contract's rules then
// narrow that.
export function legalPlays(
    hand: readonly string[],
    plays: readonly TrickPlay[],
    rules: PlayRules = OrdinaryPlay
): string[] {
    const options = rules.mustBeat
        ? withoutEarlyPagat(hand, followingOptions(hand, plays, rules))
        : followingOptions(hand, plays, rules)
    const led = plays[0]
    if (!rules.mustBeat || led === undefined) {
        return options
    }
    const best = card(winningPlay(plays, rules.trumpsWin).cardId)
    const beating = options.filter((cardId) =>
        beats(card(cardId), best, card(led.cardId), rules.trumpsWin)
    )
    return beating.length > 0 ? beating : options
}

function followingOptions(
    hand: readonly string[],
    plays: readonly TrickPlay[],
    rules: PlayRules
): string[] {
    const suitCards = hand.filter((cardId) => !isTrump(cardId))
    const led = plays[0]
    if (led === undefined) {
        return !rules.trumpsWin && suitCards.length > 0 ? suitCards : [...hand]
    }
    const ledSuit = suitOf(led.cardId)
    const following = hand.filter((cardId) => suitOf(cardId) === ledSuit)
    if (following.length > 0) {
        return following
    }
    if (!rules.trumpsWin) {
        return suitCards.length > 0 ? suitCards : [...hand]
    }
    const trumps = hand.filter(isTrump)
    return trumps.length > 0 ? trumps : [...hand]
}

const PagatId = trumpId(Pagat)

function withoutEarlyPagat(hand: readonly string[], options: string[]): string[] {
    const otherTrumps = hand.some((cardId) => isTrump(cardId) && cardId !== PagatId)
    const rest = options.filter((cardId) => cardId !== PagatId)
    return otherTrumps && rest.length > 0 ? rest : options
}

// The highest trump wins; without trumps, or where trumps do not win, the highest card of the suit
// led.
export function trickWinner(plays: readonly TrickPlay[], trumpsWin: boolean): string {
    return winningPlay(plays, trumpsWin).playerId
}

function winningPlay(plays: readonly TrickPlay[], trumpsWin: boolean): TrickPlay {
    const led = plays[0]
    assert(led !== undefined, 'An empty trick has no winner')
    const ledCard = card(led.cardId)
    let winner = led
    for (const play of plays.slice(1)) {
        if (beats(card(play.cardId), card(winner.cardId), ledCard, trumpsWin)) {
            winner = play
        }
    }
    return winner
}

function beats(challenger: Card, best: Card, led: Card, trumpsWin: boolean): boolean {
    if (challenger.kind === 'trump') {
        if (best.kind === 'trump') {
            return challenger.number > best.number
        }
        return trumpsWin || led.kind === 'trump'
    }
    if (best.kind === 'trump') {
        return false
    }
    return challenger.suit === best.suit && challenger.strength > best.strength
}
