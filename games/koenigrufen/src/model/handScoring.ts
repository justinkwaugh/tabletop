import * as Type from 'typebox'
import { cardPoints, PointsToWin } from '../components/cards.js'
import type { ContractDefinition } from '../components/contracts.js'

export type PointGameResult = {
    declarerPoints: number
    made: boolean
    scoreChanges: Record<string, number>
}

export const ScoreChanges = Type.Record(Type.String(), Type.Integer())

// Kontra on the game (per defender in negative games), and the bonuses' net worth to declarer's
// side from each defender. A Valat replaces the game.
export type GameAdjustments = {
    readonly multiplier?: (defenderId: string) => number
    readonly bonusPoints?: number
    readonly replaceGame?: boolean
}

// Each defender pays the game's value, or is paid it; declarer's side shares the other end, so a
// lone declarer receives or pays it three times over.
export function scorePointGame(
    definition: ContractDefinition,
    declarerSide: readonly string[],
    defenders: readonly string[],
    declarerSideCards: readonly string[],
    adjustments: GameAdjustments = {}
): PointGameResult {
    const declarerPoints = cardPoints(declarerSideCards)
    const made = declarerPoints >= PointsToWin
    return {
        declarerPoints,
        made,
        scoreChanges: settle(definition, declarerSide, defenders, made, adjustments)
    }
}

export type TrickGameResult = {
    made: boolean
    scoreChanges: Record<string, number>
}

// Negative games: a lone declarer must take exactly the contract's number of tricks.
export function scoreTrickGame(
    definition: ContractDefinition,
    declarerId: string,
    defenders: readonly string[],
    declarerTricks: number,
    adjustments: GameAdjustments = {}
): TrickGameResult {
    const made = declarerTricks === definition.tricksToTake
    return {
        made,
        scoreChanges: settle(definition, [declarerId], defenders, made, adjustments)
    }
}

function settle(
    definition: ContractDefinition,
    declarerSide: readonly string[],
    defenders: readonly string[],
    made: boolean,
    adjustments: GameAdjustments
): Record<string, number> {
    const value = made ? definition.win : -definition.loss
    return settleAmounts(
        declarerSide,
        defenders,
        (defenderId) =>
            (adjustments.replaceGame ? 0 : value * (adjustments.multiplier?.(defenderId) ?? 1)) +
            (adjustments.bonusPoints ?? 0)
    )
}

// Each defender pays declarer's side `amount(defender)`; declarer's side shares the takings.
export function settleAmounts(
    declarerSide: readonly string[],
    defenders: readonly string[],
    amount: (defenderId: string) => number
): Record<string, number> {
    const scoreChanges: Record<string, number> = {}
    let total = 0
    for (const playerId of defenders) {
        scoreChanges[playerId] = -amount(playerId)
        total += amount(playerId)
    }
    for (const playerId of declarerSide) {
        scoreChanges[playerId] = total / declarerSide.length
    }
    return scoreChanges
}

// Declarer pays the game's value to each defender without playing.
export function scoreGivenUp(
    definition: ContractDefinition,
    declarerId: string,
    defenders: readonly string[]
): Record<string, number> {
    const scoreChanges: Record<string, number> = {
        [declarerId]: -definition.loss * defenders.length
    }
    for (const playerId of defenders) {
        scoreChanges[playerId] = definition.loss
    }
    return scoreChanges
}

export type TrischakenPile = {
    playerId: string
    cardIds: readonly string[]
    tricks: number
}

export type TrischakenResult = {
    points: Record<string, number>
    scoreChanges: Record<string, number>
}

// Trischaken, each for themselves: the two with the most card points pay one each to the two with
// the fewest; anyone with 36 or more pays two to each other player; anyone without a trick is paid
// two by each other player. The payments add up. When the second and third highest totals tie,
// nobody can say who the two highest are, so that payment is skipped.
export function scoreTrischaken(
    definition: ContractDefinition,
    piles: readonly TrischakenPile[]
): TrischakenResult {
    const unit = definition.win
    const points = Object.fromEntries(
        piles.map((pile) => [pile.playerId, cardPoints(pile.cardIds)])
    )
    const scoreChanges = Object.fromEntries(piles.map((pile) => [pile.playerId, 0]))
    const pay = (from: string, to: string, amount: number) => {
        scoreChanges[from] -= amount * unit
        scoreChanges[to] += amount * unit
    }
    const ranked = [...piles].sort((a, b) => points[b.playerId] - points[a.playerId])
    const half = ranked.length / 2
    const highest = ranked.slice(0, half)
    const lowest = ranked.slice(half)
    if (points[highest[half - 1].playerId] > points[lowest[0].playerId]) {
        highest.forEach((pile, index) => pay(pile.playerId, lowest[index].playerId, 1))
    }
    for (const pile of piles) {
        const others = piles.filter((other) => other !== pile)
        if (points[pile.playerId] >= PointsToWin) {
            others.forEach((other) => pay(pile.playerId, other.playerId, 2))
        }
        if (pile.tricks === 0) {
            others.forEach((other) => pay(other.playerId, pile.playerId, 2))
        }
    }
    return { points, scoreChanges }
}
