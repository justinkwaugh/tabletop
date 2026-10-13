import * as Type from 'typebox'
import { TECH_FIELDS, TechField } from '../components/techFields.js'
import { surveyThreshold } from './exploration.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { EarnedMarkers, MarkerReason } from './pieces.js'
import { awardTechMarkers, returnTechMarkers } from './pools.js'

export type SettledMarkers = Type.Static<typeof SettledMarkers>
export const SettledMarkers = Type.Object({
    ...EarnedMarkers.properties,
    markers: Type.Array(Type.Number()),
    cash: Type.Number(),
    survey: Type.Boolean()
})

export function playersWithEarnedMarkers(state: HydratedStellarHorizonsGameState): string[] {
    return state
        .initiativeOrder()
        .filter((playerId) => state.getPlayerState(playerId).earnedMarkers.length > 0)
}

// Rulebook 1.12: every exploration resolves at once, then the markers earned are placed, and
// surveys follow in initiative order. Only the exploration's own markers count for a survey.
export function settleEarnedMarkers(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): SettledMarkers[] {
    const player = state.getPlayerState(playerId)
    const settled = player.earnedMarkers.map((earned) => {
        const { markers, cash } = awardTechMarkers(state, playerId, earned.field, earned.count)
        const total = markers.reduce((sum, value) => sum + value, 0)
        const survey =
            earned.reason === MarkerReason.Exploration &&
            total >= surveyThreshold(state.numPlayers)
        if (survey) {
            player.pendingSurveys.push({ shipId: earned.shipId, systemId: earned.systemId })
        }
        return { ...earned, markers, cash, survey }
    })
    player.earnedMarkers = []
    return settled
}

export function holdSpentMarkers(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    field: TechField,
    values: readonly number[]
) {
    state.getPlayerState(playerId).spentMarkers[field].push(...values)
}

export function returnSpentMarkers(state: HydratedStellarHorizonsGameState) {
    for (const player of state.players) {
        for (const field of TECH_FIELDS) {
            returnTechMarkers(state, field, player.spentMarkers[field])
            player.spentMarkers[field] = []
        }
    }
}
