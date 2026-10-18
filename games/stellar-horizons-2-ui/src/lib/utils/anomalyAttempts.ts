import {
    anomalyAttemptShips,
    anomalyStrength,
    type HydratedStellarHorizonsGameState,
    type ShipState
} from '@tabletop/stellar-horizons-2'
import type { AnomalyDraft } from '$lib/model/selection.js'
import { anomalySummary, type AnomalySummary } from './systemSummary.js'

export interface AttemptShip {
    ship: ShipState
    strength: number
    chosen: boolean
}

export interface RivalAttempt {
    playerId: string
    resolvesFirst: boolean
}

// An anomaly the player has ships at, or has already committed ships to.
export interface AnomalyOpportunity {
    systemId: string
    summary: AnomalySummary
    ships: AttemptShip[]
    chosenStrength: number
    availableStrength: number
    committedShipIds?: string[]
    rivals: RivalAttempt[]
}

export function anomalyOpportunities(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    draft: AnomalyDraft | undefined
): AnomalyOpportunity[] {
    const order = state.initiativeOrder()
    return state.systems.flatMap((system) => {
        const summary = anomalySummary(state, system.systemId, playerId)
        if (!summary) {
            return []
        }
        const attempts = state.players.flatMap((player) =>
            player.anomalyAttempts
                .filter((attempt) => attempt.systemId === system.systemId)
                .map((attempt) => ({ playerId: player.playerId, ...attempt }))
        )
        const committed = attempts.find((attempt) => attempt.playerId === playerId)
        const chosenIds = draft?.systemId === system.systemId ? draft.shipIds : []
        const ships = anomalyAttemptShips(state, playerId, system.systemId).map((ship) => ({
            ship,
            strength: anomalyStrength(ship, summary.anomaly.challenge),
            chosen: chosenIds.includes(ship.shipId)
        }))
        if (ships.length === 0 && !committed) {
            return []
        }
        const total = (entries: readonly AttemptShip[]) =>
            entries.reduce((sum, entry) => sum + entry.strength, 0)
        return [
            {
                systemId: system.systemId,
                summary,
                ships,
                chosenStrength: total(ships.filter((entry) => entry.chosen)),
                availableStrength: total(ships),
                committedShipIds: committed?.shipIds,
                rivals: attempts
                    .filter((attempt) => attempt.playerId !== playerId)
                    .map((attempt) => ({
                        playerId: attempt.playerId,
                        resolvesFirst: order.indexOf(attempt.playerId) < order.indexOf(playerId)
                    }))
            }
        ]
    })
}
