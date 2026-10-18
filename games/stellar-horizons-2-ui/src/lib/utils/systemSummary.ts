import {
    FACTIONS,
    anomalyDifficulty,
    eventChallenges,
    eventDifficulty,
    eventsIn,
    resolvedAnomaly,
    standingPacts,
    systemAnomaly,
    settlementVictory,
    systemDefinition,
    type AnomalyChallenge,
    type AnomalyDefinition,
    type Faction,
    type Pact,
    type HydratedStellarHorizonsGameState,
    type ShipState
} from '@tabletop/stellar-horizons-2'

export interface FleetSummary {
    playerId: string
    faction?: Faction
    settlements: number
    ships: ShipState[]
}

export interface AnomalySummary {
    anomaly: AnomalyDefinition
    difficulty: number
    players: number
}

export interface EventSummary {
    eventId: string
    challenges: { challenge: AnomalyChallenge; difficulty: number | undefined }[]
}

export interface SystemSummary {
    name: string
    anomaly?: AnomalySummary
    turnedOver?: AnomalyDefinition
    events: EventSummary[]
    pacts: Pact[]
    settlementGoal?: number
    fleets: FleetSummary[]
}

export function systemSummary(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    viewerId: string | undefined
): SystemSummary {
    return {
        name: systemDefinition(systemId).name,
        anomaly: anomalySummary(state, systemId, viewerId),
        turnedOver: resolvedAnomaly(state, systemId),
        events: eventsIn(state, systemId).map((active) => ({
            eventId: active.eventId,
            challenges: eventChallenges(active.eventId).map((challenge) => ({
                challenge,
                difficulty: eventDifficulty(state, active.eventId, challenge, viewerId)
            }))
        })),
        pacts: standingPacts(state).filter((pact) => pact.systemId === systemId),
        settlementGoal: settlementVictory(state.scenarioDefinition())?.settlements,
        fleets: fleets(state, systemId, viewerId)
    }
}

// The difficulty is the viewer's, with their faction's modifier.
export function anomalySummary(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    viewerId?: string
): AnomalySummary | undefined {
    const anomaly = systemAnomaly(state, systemId)
    return anomaly
        ? {
              anomaly,
              difficulty: anomalyDifficulty(state, anomaly.id, viewerId),
              players: state.numPlayers
          }
        : undefined
}

function fleets(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    viewerId: string | undefined
): FleetSummary[] {
    const present = state.players.filter(
        (player) =>
            state
                .allShips()
                .some(
                    (ship) => ship.systemId === systemId && ship.playerId === player.playerId
                ) || state.base(player.playerId, systemId) !== undefined
    )
    const order = (playerId: string, faction?: Faction) =>
        playerId === viewerId
            ? -1
            : faction
              ? FACTIONS.findIndex((candidate) => candidate.faction === faction)
              : FACTIONS.length
    return present
        .toSorted((a, b) => order(a.playerId, a.faction) - order(b.playerId, b.faction))
        .map((player) => ({
            playerId: player.playerId,
            faction: player.faction,
            settlements: state.base(player.playerId, systemId)?.settlements ?? 0,
            ships: state
                .allShips()
                .filter((ship) => ship.systemId === systemId && ship.playerId === player.playerId)
        }))
}
