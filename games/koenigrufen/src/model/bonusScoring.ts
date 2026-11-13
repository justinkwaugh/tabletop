import * as Type from 'typebox'
import { cardPoints, isKing, isTrull } from '../components/cards.js'
import { BonusScope, type ContractDefinition } from '../components/contracts.js'
import {
    Birds,
    Bonus,
    Bonuses,
    BonusOrder,
    BonusSchema,
    MaxDoubles,
    SackPoints,
    Side,
    SideSchema,
    type Announcements
} from './announcements.js'
import type { CompletedTrick } from './tricks.js'

export type BonusResult = Type.Static<typeof BonusResult>
export const BonusResult = Type.Object({
    bonus: BonusSchema,
    side: SideSchema,
    announced: Type.Boolean(),
    doubles: Type.Integer({ minimum: 0, maximum: MaxDoubles }),
    made: Type.Boolean(),
    // What each player of the other side pays `side` (negative: is paid by it), as for the game.
    points: Type.Integer()
})

export type BonusHand = {
    readonly definition: ContractDefinition
    readonly announcements: Announcements
    readonly tricks: readonly CompletedTrick[]
    readonly sideOf: (playerId: string) => Side
    // Each side's tricks with its share of the talon.
    readonly cards: Readonly<Record<Side, readonly string[]>>
    // The called King, in a king-calling contract.
    readonly isCalledKing?: (cardId: string, playerId: string) => boolean
}

export type BonusScoring = {
    results: BonusResult[]
    // A Valat, announced or made, replaces the game and every other bonus.
    valat: boolean
}

// Bonuses score for or against the side that went for them. Announced, each is won or lost at its
// announced value; silent, the Trull, Four Kings and Valat score for the side that took them, and a
// bird or the called King played to its trick wins or loses for its side. Each Kontra doubles, and
// Solo contracts double all but Valat. The colour games score only Valat and Four Kings.
export function scoreBonuses(hand: BonusHand): BonusScoring {
    const { definition, announcements } = hand
    if (definition.bonuses === BonusScope.None) {
        return { results: [], valat: false }
    }
    const valat = scoreValat(hand)
    if (valat.length > 0) {
        return { results: valat, valat: valat.length > 0 }
    }
    const factor = definition.bonusesDoubled ? 2 : 1
    const results: BonusResult[] = []
    for (const bonus of BonusOrder) {
        if (
            bonus === Bonus.Valat ||
            (definition.bonuses === BonusScope.ValatAndFourKings && bonus !== Bonus.FourKings)
        ) {
            continue
        }
        const value = Bonuses[bonus]
        const announced = announcements.bonuses.filter((entry) => entry.bonus === bonus)
        for (const entry of announced) {
            const made = achieved(hand, bonus, entry.side)
            results.push({
                bonus,
                side: entry.side,
                announced: true,
                doubles: entry.doubles,
                made,
                points: (made ? 1 : -1) * value.announced * factor * 2 ** entry.doubles
            })
        }
        const silent = value.silent
        if (announced.length > 0 || silent === undefined) {
            continue
        }
        const attempt = silentAttempt(hand, bonus)
        if (attempt) {
            results.push({
                bonus,
                side: attempt.side,
                announced: false,
                doubles: 0,
                made: attempt.made,
                points: (attempt.made ? 1 : -1) * silent * factor
            })
        }
    }
    return { results, valat: false }
}

function scoreValat(hand: BonusHand): BonusResult[] {
    const value = Bonuses[Bonus.Valat]
    const game = hand.definition.win
    const announced = hand.announcements.bonuses.filter((entry) => entry.bonus === Bonus.Valat)
    if (announced.length > 0) {
        return announced.map((entry) => {
            const made = achieved(hand, Bonus.Valat, entry.side)
            return {
                bonus: Bonus.Valat,
                side: entry.side,
                announced: true,
                doubles: entry.doubles,
                made,
                points: (made ? 1 : -1) * (value.announced * game) * 2 ** entry.doubles
            }
        })
    }
    const side = valatSide(hand)
    if (side === undefined || value.silent === undefined) {
        return []
    }
    return [
        {
            bonus: Bonus.Valat,
            side,
            announced: false,
            doubles: 0,
            made: true,
            points: value.silent * game
        }
    ]
}

function valatSide(hand: BonusHand): Side | undefined {
    const sides = new Set(hand.tricks.map((trick) => hand.sideOf(trick.winnerId)))
    const [side] = sides
    return sides.size === 1 && hand.tricks.length === 12 ? side : undefined
}

function lastTrickWithCalledKing(hand: BonusHand): CompletedTrick | undefined {
    const last = hand.tricks.at(-1)
    const isCalledKing = hand.isCalledKing
    return last !== undefined &&
        isCalledKing !== undefined &&
        last.plays.some((play) => isCalledKing(play.cardId, play.playerId))
        ? last
        : undefined
}

// A bird played to its own trick, and whether it won it.
function birdPlay(hand: BonusHand, bonus: Bonus) {
    const bird = Birds[bonus]
    const trick = bird === undefined ? undefined : hand.tricks[bird.trick]
    const play = trick?.plays.find((candidate) => candidate.cardId === bird?.cardId)
    return play && trick
        ? { playerId: play.playerId, won: trick.winnerId === play.playerId }
        : undefined
}

function achieved(hand: BonusHand, bonus: Bonus, side: Side): boolean {
    const cards = hand.cards[side]
    switch (bonus) {
        case Bonus.Trull:
            return cards.filter(isTrull).length === 3
        case Bonus.FourKings:
            return cards.filter(isKing).length === 4
        case Bonus.KingUltimo: {
            const last = lastTrickWithCalledKing(hand)
            return last !== undefined && hand.sideOf(last.winnerId) === side
        }
        case Bonus.Valat:
            return valatSide(hand) === side
        case Bonus.Sack:
            return cardPoints(cards) >= SackPoints
        default: {
            const play = birdPlay(hand, bonus)
            return play !== undefined && play.won && hand.sideOf(play.playerId) === side
        }
    }
}

function silentAttempt(hand: BonusHand, bonus: Bonus): { side: Side; made: boolean } | undefined {
    switch (bonus) {
        case Bonus.Trull:
        case Bonus.FourKings: {
            const side = [Side.Declarer, Side.Defenders].find((candidate) =>
                achieved(hand, bonus, candidate)
            )
            return side === undefined ? undefined : { side, made: true }
        }
        case Bonus.KingUltimo: {
            const last = lastTrickWithCalledKing(hand)
            return last === undefined
                ? undefined
                : { side: Side.Declarer, made: hand.sideOf(last.winnerId) === Side.Declarer }
        }
        case Bonus.Valat:
        case Bonus.Sack:
            return undefined
        default: {
            const play = birdPlay(hand, bonus)
            return play === undefined
                ? undefined
                : { side: hand.sideOf(play.playerId), made: play.won }
        }
    }
}
