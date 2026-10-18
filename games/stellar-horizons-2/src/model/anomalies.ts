import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import {
    AnomalyBackKind,
    AnomalyChallenge,
    anomalyDefinition,
    type AnomalyDefinition,
    type BaseEffects
} from '../components/anomalies.js'
import { shipDefinition } from '../components/ships.js'
import { factionAbilities, gainInfluence } from './campaign.js'
import { currentCombat, currentExploration, hasArrived, isCrippled } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { PendingAnomalyAttempt, ShipState } from './pieces.js'
import type { HydratedStellarHorizonsPlayerState } from './playerState.js'

export const RESEARCH_SHIP_BONUS = 1

export type AnomalySearch = Type.Static<typeof AnomalySearch>
export const AnomalySearch = Type.Object({
    roll: Type.Number(),
    anomalyId: Type.Optional(Type.String())
})

export function systemAnomaly(
    state: HydratedStellarHorizonsGameState,
    systemId: string
): AnomalyDefinition | undefined {
    const system = state.systemState(systemId)
    return system.anomaly === undefined || system.anomalyResolved
        ? undefined
        : anomalyDefinition(system.anomaly)
}

// The anomaly turned over in a system, whose back gives bases there a permanent effect.
export function resolvedAnomaly(
    state: HydratedStellarHorizonsGameState,
    systemId: string
): AnomalyDefinition | undefined {
    const system = state.systemState(systemId)
    return system.anomaly !== undefined && system.anomalyResolved
        ? anomalyDefinition(system.anomaly)
        : undefined
}

// What the anomaly turned over in a system does for bases there (rulebook 1.16).
export function baseEffects(
    state: HydratedStellarHorizonsGameState,
    systemId: string
): BaseEffects {
    const back = resolvedAnomaly(state, systemId)?.back
    return back?.kind === AnomalyBackKind.Bases ? back.effects : {}
}

export function blocksExploration(state: HydratedStellarHorizonsGameState, systemId: string) {
    return systemAnomaly(state, systemId)?.noExploration ?? false
}

export function blocksBases(state: HydratedStellarHorizonsGameState, systemId: string) {
    return systemAnomaly(state, systemId)?.noBases ?? false
}

export function usesAnomalyRewards(state: HydratedStellarHorizonsGameState): boolean {
    return state.scenarioDefinition().anomalies?.rewards ?? false
}

export const ANOMALY_INFLUENCE = 1

// Rulebook 1.16: printed difficulty plus the number of players; in the campaign the Starfarers
// take 1 off science challenges and the Syndicate 2 off combat challenges.
export function anomalyDifficulty(
    state: HydratedStellarHorizonsGameState,
    anomalyId: string,
    playerId?: string
): number {
    const anomaly = anomalyDefinition(anomalyId)
    const abilities = playerId === undefined ? {} : factionAbilities(state, playerId)
    const modifier =
        anomaly.challenge === AnomalyChallenge.Combat
            ? abilities.combatAnomalyDifficulty
            : abilities.scienceAnomalyDifficulty
    return anomaly.difficulty + state.numPlayers + (modifier ?? 0)
}

// Every completed survey rolls; a system holds one anomaly at a time (rulebook 1.16).
// Campaign: finding an anomaly earns 1 IP even when the system already has one or the pool is
// empty; the Starfarers find one on 30% instead of 20%.
export function searchForAnomaly(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    playerId: string
): AnomalySearch | undefined {
    const anomalies = state.scenarioDefinition().anomalies
    if (!anomalies) {
        return undefined
    }
    const random = state.getProtectedPrng()
    const roll = random.dieRoll(100)
    const system = state.systemState(systemId)
    const chance = factionAbilities(state, playerId).anomalyChance ?? anomalies.chance
    if (roll > chance) {
        return { roll }
    }
    gainInfluence(state, playerId, ANOMALY_INFLUENCE)
    if (system.anomaly !== undefined || state.anomalyPool.length === 0) {
        return { roll }
    }
    const [anomalyId] = state.anomalyPool.splice(random.randInt(state.anomalyPool.length), 1)
    system.anomaly = anomalyId
    return { roll, anomalyId }
}

export type AnomalyResolution = Type.Static<typeof AnomalyResolution>
export const AnomalyResolution = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    anomalyId: Type.String(),
    shipIds: Type.Array(Type.String()),
    resolved: Type.Boolean()
})

// Only the ship's own value counts, with +1 for a research ship on a science challenge; tech
// and system bonuses do not apply (rulebook 1.16).
export function anomalyStrength(ship: ShipState, challenge: AnomalyChallenge): number {
    if (challenge === AnomalyChallenge.Combat) {
        return currentCombat(ship)
    }
    const research = shipDefinition(ship.shipId).research ? RESEARCH_SHIP_BONUS : 0
    return currentExploration(ship) + research
}

export function canJoinAnomalyAttempt(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState
): boolean {
    const anomaly = systemAnomaly(state, ship.systemId)
    return (
        anomaly !== undefined &&
        hasArrived(ship) &&
        !ship.explored &&
        !isCrippled(ship) &&
        anomalyStrength(ship, anomaly.challenge) > 0
    )
}

export function anomalyAttemptShips(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): ShipState[] {
    return state
        .shipsOf(playerId)
        .filter((ship) => ship.systemId === systemId && canJoinAnomalyAttempt(state, ship))
}

export function attemptStrength(ships: readonly ShipState[], challenge: AnomalyChallenge): number {
    return ships.reduce((total, ship) => total + anomalyStrength(ship, challenge), 0)
}

export function hasPendingAttempt(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): boolean {
    return state
        .getPlayerState(playerId)
        .anomalyAttempts.some((attempt) => attempt.systemId === systemId)
}

export function isValidAnomalyAttempt(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    shipIds: readonly string[]
): boolean {
    const anomaly = state.isSystemInPlay(systemId) ? systemAnomaly(state, systemId) : undefined
    if (!anomaly || hasPendingAttempt(state, playerId, systemId)) {
        return false
    }
    const available = anomalyAttemptShips(state, playerId, systemId)
    const chosen = available.filter((ship) => shipIds.includes(ship.shipId))
    return (
        shipIds.length > 0 &&
        new Set(shipIds).size === shipIds.length &&
        chosen.length === shipIds.length &&
        attemptStrength(chosen, anomaly.challenge) >= anomalyDifficulty(state, anomaly.id, playerId)
    )
}

export function attemptableSystemIds(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): string[] {
    return state.systems
        .filter((system) => {
            const available = anomalyAttemptShips(state, playerId, system.systemId)
            return isValidAnomalyAttempt(
                state,
                playerId,
                system.systemId,
                available.map((ship) => ship.shipId)
            )
        })
        .map((system) => system.systemId)
}

export function commitAnomalyAttempt(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    shipIds: readonly string[]
): PendingAnomalyAttempt {
    const anomaly = systemAnomaly(state, systemId)
    assertExists(anomaly, `No anomaly at ${systemId}`)
    for (const shipId of shipIds) {
        state.ship(shipId).explored = true
    }
    const attempt = { systemId, anomalyId: anomaly.id, shipIds: [...shipIds] }
    state.getPlayerState(playerId).anomalyAttempts.push(attempt)
    return attempt
}

export function anyAnomalyAttempts(state: HydratedStellarHorizonsGameState): boolean {
    return state.players.some((player) => player.anomalyAttempts.length > 0)
}

function nextAttempter(
    state: HydratedStellarHorizonsGameState
): HydratedStellarHorizonsPlayerState {
    const playerId = state
        .initiativeOrder()
        .find((candidate) => state.getPlayerState(candidate).anomalyAttempts.length > 0)
    assertExists(playerId, 'No anomaly attempt to resolve')
    return state.getPlayerState(playerId)
}

// Attempts resolve in initiative order; whoever comes after the anomaly has been taken has
// spent their ships' actions for nothing.
export function resolveNextAnomalyAttempt(
    state: HydratedStellarHorizonsGameState
): AnomalyResolution {
    const player = nextAttempter(state)
    const [attempt, ...remaining] = player.anomalyAttempts
    player.anomalyAttempts = remaining
    const resolved = systemAnomaly(state, attempt.systemId)?.id === attempt.anomalyId
    if (resolved) {
        player.anomalies.push(attempt.anomalyId)
        // Without rewards the resolver keeps the tile (These are the Voyages); with them it is
        // turned over where it lies.
        if (!usesAnomalyRewards(state)) {
            state.systemState(attempt.systemId).anomaly = undefined
        }
    }
    return { playerId: player.playerId, ...attempt, resolved }
}
