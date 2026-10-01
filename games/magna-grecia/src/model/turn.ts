import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'
import { enhancedResupply, type ActionCard } from '../components/actionCards.js'

export enum PendingCityKind {
    Claim = 'Claim',
    Founding = 'Founding'
}

export type PendingCity = Type.Static<typeof PendingCity>
export const PendingCity = Type.Union([
    Type.Object({
        kind: Type.Literal(PendingCityKind.Claim),
        village: AxialCoordinates,
        cityId: Type.String(),
        founding: Type.Boolean()
    }),
    Type.Object({
        kind: Type.Literal(PendingCityKind.Founding),
        cityId: Type.String()
    })
])

export type TurnProgress = Type.Static<typeof TurnProgress>
export const TurnProgress = Type.Object({
    playerId: Type.String(),
    roadsPlaced: Type.Number(),
    citiesPlaced: Type.Number(),
    foundedCity: Type.Boolean(),
    resupplied: Type.Boolean(),
    marketDone: Type.Boolean(),
    pendingCity: Type.Optional(PendingCity)
})

export function newTurn(playerId: string): TurnProgress {
    return {
        playerId,
        roadsPlaced: 0,
        citiesPlaced: 0,
        foundedCity: false,
        resupplied: false,
        marketDone: false
    }
}

export function hasUnfinishedCity(turn: TurnProgress): boolean {
    return turn.pendingCity !== undefined
}

// Building or selling a market follows the tile actions, so it closes them and leaves only End turn.
export function marketPhaseDone(turn: TurnProgress): boolean {
    return turn.marketDone
}

// A player takes up to two of the card's three basic actions, or one of them enhanced by one step.
export function remainingRoadPlacements(card: ActionCard, turn: TurnProgress): number {
    if (
        turn.resupplied ||
        marketPhaseDone(turn) ||
        hasUnfinishedCity(turn) ||
        turn.citiesPlaced > card.cities
    ) {
        return 0
    }
    const limit = turn.citiesPlaced > 0 ? card.roads : card.roads + 1
    return Math.max(0, limit - turn.roadsPlaced)
}

export function remainingCityPlacements(card: ActionCard, turn: TurnProgress): number {
    if (turn.resupplied || marketPhaseDone(turn) || turn.roadsPlaced > card.roads) {
        return 0
    }
    const limit = turn.roadsPlaced > 0 ? card.cities : card.cities + 1
    return Math.max(0, limit - turn.citiesPlaced)
}

export function resupplyLimit(card: ActionCard, turn: TurnProgress): number {
    if (turn.resupplied || marketPhaseDone(turn) || hasUnfinishedCity(turn)) {
        return 0
    }
    const usedRoads = turn.roadsPlaced > 0
    const usedCities = turn.citiesPlaced > 0
    if (
        (usedRoads && usedCities) ||
        turn.roadsPlaced > card.roads ||
        turn.citiesPlaced > card.cities
    ) {
        return 0
    }
    return usedRoads || usedCities ? card.resupply : enhancedResupply(card.resupply)
}

// The enhanced action is the one taken past the card's basic value; it is then the turn's only action.
export function enhancedAction(
    card: ActionCard,
    turn: TurnProgress
): 'roads' | 'cities' | undefined {
    if (turn.roadsPlaced > card.roads) {
        return 'roads'
    }
    if (turn.citiesPlaced > card.cities) {
        return 'cities'
    }
    return undefined
}

// Splits what is left of an action into the part within the card's basic value and the enhanced extra.
export type Allowance = { basic: number; bonus: number }

export function splitAllowance(available: number, basicLeft: number): Allowance {
    const basic = Math.min(available, Math.max(0, basicLeft))
    return { basic, bonus: available - basic }
}
