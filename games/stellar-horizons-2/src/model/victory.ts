import { AnomalyChallenge, anomalyDefinition } from '../components/anomalies.js'
import { VictoryKind, settlementVictory, type AnomalyVictory } from '../components/scenarios.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { Base } from './pieces.js'
import type { HydratedStellarHorizonsPlayerState } from './playerState.js'
import { placementPopulation } from './surveys.js'

export function systemPopulation(state: HydratedStellarHorizonsGameState, systemId: string) {
    return state
        .systemState(systemId)
        .worlds.reduce((total, world) => total + placementPopulation(world), 0)
}

export function isWinningBase(state: HydratedStellarHorizonsGameState, base: Base): boolean {
    const victory = settlementVictory(state.scenarioDefinition())
    return (
        victory !== undefined &&
        base.settlements >= victory.settlements &&
        systemPopulation(state, base.systemId) >= victory.systemPopulation
    )
}

export function hasResolvedEnough(
    player: HydratedStellarHorizonsPlayerState,
    victory: AnomalyVictory
): boolean {
    return (
        player.anomalies.length >= victory.resolved &&
        Object.values(AnomalyChallenge).every(
            (challenge) => player.anomaliesResolved(challenge) >= victory.ofEachChallenge
        )
    )
}

export function victoriousPlayerIds(state: HydratedStellarHorizonsGameState): string[] {
    const victory = state.scenarioDefinition().victory
    return state.initiativeOrder().filter((playerId) => {
        switch (victory.kind) {
            case VictoryKind.Settlements:
                return state.basesOf(playerId).some((base) => isWinningBase(state, base))
            case VictoryKind.Anomalies:
                return hasResolvedEnough(state.getPlayerState(playerId), victory)
        }
    })
}

function anomaliesCanStillAppear(state: HydratedStellarHorizonsGameState): boolean {
    return (
        state.anomalyPool.length > 0 && state.systems.some((system) => system.explorationMarker > 0)
    )
}

function canStillResolveEnough(
    state: HydratedStellarHorizonsGameState,
    player: HydratedStellarHorizonsPlayerState,
    victory: AnomalyVictory
): boolean {
    const unresolved = state.systems.flatMap((system) =>
        system.anomaly === undefined ? [] : [anomalyDefinition(system.anomaly).challenge]
    )
    return (
        player.anomalies.length + unresolved.length >= victory.resolved &&
        Object.values(AnomalyChallenge).every(
            (challenge) =>
                player.anomaliesResolved(challenge) +
                    unresolved.filter((candidate) => candidate === challenge).length >=
                victory.ofEachChallenge
        )
    )
}

// The anomaly race has no deadline, so it ends without a winner once no new anomaly can be
// found and nobody can reach the goal with the ones still on the map.
export function canStillBeWon(state: HydratedStellarHorizonsGameState): boolean {
    const victory = state.scenarioDefinition().victory
    if (victory.kind !== VictoryKind.Anomalies) {
        return true
    }
    return (
        anomaliesCanStillAppear(state) ||
        state.players.some((player) => canStillResolveEnough(state, player, victory))
    )
}
