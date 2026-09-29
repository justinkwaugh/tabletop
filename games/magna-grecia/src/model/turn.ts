import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'
import { enhancedResupply, type ActionCard } from '../components/actionCards.js'

export type PendingClaim = Type.Static<typeof PendingClaim>
export const PendingClaim = Type.Object({
    village: AxialCoordinates,
    cityId: Type.String(),
    founding: Type.Boolean()
})

export type TurnProgress = Type.Static<typeof TurnProgress>
export const TurnProgress = Type.Object({
    playerId: Type.String(),
    roadsPlaced: Type.Number(),
    citiesPlaced: Type.Number(),
    foundedCity: Type.Boolean(),
    resupplied: Type.Boolean(),
    pendingClaim: Type.Optional(PendingClaim)
})

export function newTurn(playerId: string): TurnProgress {
    return {
        playerId,
        roadsPlaced: 0,
        citiesPlaced: 0,
        foundedCity: false,
        resupplied: false
    }
}

// A player takes up to two of the card's three basic actions, or one of them enhanced by one step.
export function remainingRoadPlacements(card: ActionCard, turn: TurnProgress): number {
    if (turn.resupplied || turn.pendingClaim || turn.citiesPlaced > card.cities) {
        return 0
    }
    const limit = turn.citiesPlaced > 0 ? card.roads : card.roads + 1
    return Math.max(0, limit - turn.roadsPlaced)
}

export function remainingCityPlacements(card: ActionCard, turn: TurnProgress): number {
    if (turn.resupplied || turn.roadsPlaced > card.roads) {
        return 0
    }
    const limit = turn.roadsPlaced > 0 ? card.cities : card.cities + 1
    return Math.max(0, limit - turn.citiesPlaced)
}

export function resupplyLimit(card: ActionCard, turn: TurnProgress): number {
    if (turn.resupplied || turn.pendingClaim) {
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
