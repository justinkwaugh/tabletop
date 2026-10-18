import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { AnomalyChallenge } from '../components/anomalies.js'
import {
    EventEffectKind,
    EventTiming,
    eventDefinition,
    type EventDefinition
} from '../components/events.js'
import { ShipKind, shipDefinition } from '../components/ships.js'
import { systemDistance } from '../components/systems.js'
import { TechField } from '../components/techFields.js'
import { TECHS } from '../components/techs.js'
import { worldTile, WorldSide } from '../components/worlds.js'
import { anomalyStrength, attemptStrength } from './anomalies.js'
import { factionAbilities, gainInfluence } from './campaign.js'
import { hasArrived, isCrippled, removeShip } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { isHeld } from './holds.js'
import type { ActiveEvent, Base, ShipState } from './pieces.js'
import { awardTechMarkers, drawWorldTile, returnWorldTile } from './pools.js'
import { addSettlements, removeBaseSettlement } from './settling.js'
import { placementPopulation } from './surveys.js'
import { roundHalfUp } from './turn.js'

export function activeEvent(
    state: HydratedStellarHorizonsGameState,
    eventId: string
): ActiveEvent | undefined {
    return state.events.find((candidate) => candidate.eventId === eventId)
}

export function eventsIn(state: HydratedStellarHorizonsGameState, systemId: string): ActiveEvent[] {
    return state.events.filter((candidate) => candidate.systemId === systemId)
}

function hasEffect(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    kind: EventEffectKind
) {
    return eventsIn(state, systemId).some(
        (candidate) => eventDefinition(candidate.eventId).effect.kind === kind
    )
}

// Unrest: no base production or growth in its system while it is unresolved.
export function halts(state: HydratedStellarHorizonsGameState, systemId: string): boolean {
    return hasEffect(state, systemId, EventEffectKind.NoProductionOrGrowth)
}

// First Contact: Earth production gives one more marker of each type while it is unresolved.
export function extraEarthMarkers(state: HydratedStellarHorizonsGameState): number {
    return state.events.reduce((total, candidate) => {
        const effect = eventDefinition(candidate.eventId).effect
        return total + (effect.kind === EventEffectKind.EarthProduction ? effect.markers : 0)
    }, 0)
}

function basesIn(state: HydratedStellarHorizonsGameState, systemId: string): Base[] {
    return state.allBases().filter((base) => base.systemId === systemId)
}

// "They affect all players in the system": the Players with a base there.
function playersIn(state: HydratedStellarHorizonsGameState, systemId: string): string[] {
    const owners = new Set(basesIn(state, systemId).map((base) => base.playerId))
    return state.initiativeOrder().filter((playerId) => owners.has(playerId))
}

// The Player with the worst initiative who has a base places a challenge (rulebook 4.2).
export function eventPlacer(state: HydratedStellarHorizonsGameState): string | undefined {
    return state
        .initiativeOrder()
        .toReversed()
        .find((playerId) => state.basesOf(playerId).length > 0)
}

export function eventPlacementSystems(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): string[] {
    return state.basesOf(playerId).map((base) => base.systemId)
}

export type EventOutcome = Type.Static<typeof EventOutcome>
export const EventOutcome = Type.Object({
    eventId: Type.String(),
    systemId: Type.Optional(Type.String()),
    players: Type.Array(Type.String()),
    settlementsLost: Type.Array(
        Type.Object({ playerId: Type.String(), systemId: Type.String(), roll: Type.Number() })
    ),
    replaced: Type.Optional(Type.Object({ from: Type.String(), to: Type.String() })),
    shipsLost: Type.Array(Type.String())
})

function outcome(eventId: string, systemId?: string): EventOutcome {
    return { eventId, systemId, players: [], settlementsLost: [], shipsLost: [] }
}

function lowestBy(
    state: HydratedStellarHorizonsGameState,
    candidates: readonly string[],
    measure: (playerId: string) => number
): string[] {
    if (candidates.length === 0) {
        return []
    }
    const least = Math.min(...candidates.map(measure))
    return candidates.filter((playerId) => measure(playerId) === least)
}

function printedTechTotal(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    field: TechField
) {
    const player = state.getPlayerState(playerId)
    return TECHS.filter((tech) => tech.field === field && player.ownsTech(tech.id)).reduce(
        (total, tech) => total + tech.cost,
        0
    )
}

function settlementTotal(state: HydratedStellarHorizonsGameState, playerId: string) {
    return state.basesOf(playerId).reduce((total, base) => total + base.settlements, 0)
}

// An event without a challenge acts as it is drawn. Colonial Rush and Homesteaders favour the
// Players with the fewest settlements among those with a base; Homesteaders' Players then
// choose the base.
export function applyDrawnEvent(
    state: HydratedStellarHorizonsGameState,
    definition: EventDefinition
): EventOutcome {
    const result = outcome(definition.id)
    const effect = definition.effect
    const withBases = state
        .initiativeOrder()
        .filter((playerId) => state.basesOf(playerId).length > 0)
    switch (effect.kind) {
        case EventEffectKind.Breakthrough: {
            result.players = lowestBy(state, state.initiativeOrder(), (playerId) =>
                printedTechTotal(state, playerId, effect.field)
            )
            for (const playerId of result.players) {
                state.getPlayerState(playerId).breakthroughs.push(effect.field)
            }
            break
        }
        case EventEffectKind.ColonialRush: {
            result.players = lowestBy(state, withBases, (playerId) =>
                settlementTotal(state, playerId)
            )
            for (const playerId of result.players) {
                for (const base of state.basesOf(playerId)) {
                    addSettlements(state, playerId, base.systemId, effect.settlements)
                }
            }
            break
        }
        case EventEffectKind.Homesteaders: {
            result.players = lowestBy(state, withBases, (playerId) =>
                settlementTotal(state, playerId)
            )
            state.homesteaders = [...result.players]
            break
        }
        default:
            break
    }
    return result
}

function halve(state: HydratedStellarHorizonsGameState, base: Base) {
    const keep = roundHalfUp(base.settlements / 2)
    while (base.settlements > keep && state.base(base.playerId, base.systemId)) {
        removeBaseSettlement(state, base.playerId, base.systemId)
    }
}

function replaceHighestWorld(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    result: EventOutcome,
    worldClass: string
) {
    const worlds = state.systemState(systemId).worlds
    if (worlds.length === 0) {
        return
    }
    const slot = worlds.reduce(
        (best, world, index) =>
            placementPopulation(world) > placementPopulation(worlds[best]) ? index : best,
        0
    )
    const tileId = drawWorldTile(
        state,
        (candidate) => worldTile(candidate).worldClass === worldClass
    )
    if (tileId === undefined) {
        return
    }
    const replaced = worlds[slot]
    worlds[slot] = { tileId, side: WorldSide.I }
    returnWorldTile(state, replaced.tileId)
    result.replaced = { from: replaced.tileId, to: tileId }
}

function explorersWithin(state: HydratedStellarHorizonsGameState, systemId: string, range: number) {
    return state
        .allShips()
        .filter(
            (ship) =>
                shipDefinition(ship.shipId).kind === ShipKind.RE &&
                systemDistance(ship.systemId, systemId) <= range
        )
}

// A challenge still unresolved when the next event is drawn acts, then returns to the pool.
export function triggerNextEventEffects(state: HydratedStellarHorizonsGameState): EventOutcome[] {
    const triggered = state.events.filter(
        (candidate) => eventDefinition(candidate.eventId).timing === EventTiming.NextEvent
    )
    const results = triggered.map((active) => {
        const effect = eventDefinition(active.eventId).effect
        const result = outcome(active.eventId, active.systemId)
        switch (effect.kind) {
            case EventEffectKind.HalveBases:
                for (const base of basesIn(state, active.systemId)) {
                    result.players.push(base.playerId)
                    halve(state, base)
                }
                break
            case EventEffectKind.ReplaceWorld:
                replaceHighestWorld(state, active.systemId, result, effect.worldClass)
                break
            case EventEffectKind.LoseInfluenceAndCash:
                for (const playerId of playersIn(state, active.systemId)) {
                    const player = state.getPlayerState(playerId)
                    player.influence = Math.max(0, player.influence - effect.influence)
                    player.cash = Math.max(0, player.cash - effect.cash)
                    result.players.push(playerId)
                }
                break
            case EventEffectKind.ExplorersMalfunction:
                for (const ship of explorersWithin(state, active.systemId, effect.range)) {
                    removeShip(state, ship.shipId)
                    awardTechMarkers(state, ship.playerId, TechField.Engineering, 1)
                    result.shipsLost.push(ship.shipId)
                }
                break
            default:
                break
        }
        return result
    })
    state.events = state.events.filter((candidate) => !triggered.includes(candidate))
    state.eventPool.push(...triggered.map((candidate) => candidate.eventId))
    return results
}

export function drawEvent(state: HydratedStellarHorizonsGameState): string | undefined {
    if (state.eventPool.length === 0) {
        return undefined
    }
    const random = state.getProtectedPrng()
    const [eventId] = state.eventPool.splice(random.randInt(state.eventPool.length), 1)
    return eventId
}

// Effects acting at the end of every turn while their events are unresolved.
export function applyEachTurnEffects(state: HydratedStellarHorizonsGameState): EventOutcome[] {
    const random = state.getProtectedPrng()
    return state.events.flatMap((active) => {
        const definition = eventDefinition(active.eventId)
        if (definition.timing !== EventTiming.EachTurn) {
            return []
        }
        const effect = definition.effect
        const result = outcome(active.eventId, active.systemId)
        switch (effect.kind) {
            case EventEffectKind.LoseInfluence:
                for (const playerId of playersIn(state, active.systemId)) {
                    const player = state.getPlayerState(playerId)
                    if (player.influence > 0) {
                        player.influence = Math.max(0, player.influence - effect.influence)
                        result.players.push(playerId)
                    }
                }
                break
            case EventEffectKind.LoseCash:
                for (const playerId of playersIn(state, active.systemId)) {
                    const player = state.getPlayerState(playerId)
                    player.cash = Math.max(0, player.cash - effect.cash)
                    result.players.push(playerId)
                }
                break
            case EventEffectKind.DestroySettlements:
                for (const base of state
                    .allBases()
                    .filter(
                        (candidate) =>
                            systemDistance(candidate.systemId, active.systemId) <= effect.range
                    )) {
                    const roll = random.dieRoll(10)
                    if (roll <= effect.roll) {
                        removeBaseSettlement(state, base.playerId, base.systemId)
                        result.settlementsLost.push({
                            playerId: base.playerId,
                            systemId: base.systemId,
                            roll
                        })
                    }
                }
                break
            default:
                return []
        }
        return [result]
    })
}

// An event leaves when every base in its system is gone (rulebook 1.16).
export function releaseAbandonedEvents(state: HydratedStellarHorizonsGameState): string[] {
    const abandoned = state.events.filter(
        (candidate) => basesIn(state, candidate.systemId).length === 0
    )
    state.events = state.events.filter((candidate) => !abandoned.includes(candidate))
    state.eventPool.push(...abandoned.map((candidate) => candidate.eventId))
    return abandoned.map((candidate) => candidate.eventId)
}

// Resolving events works as for anomalies: ships in the system, printed difficulty plus the
// number of players, research ships +1 on science, the faction modifiers; AI Sentient
// Emergence may be met either way.
export function eventDifficulty(
    state: HydratedStellarHorizonsGameState,
    eventId: string,
    challenge: AnomalyChallenge,
    playerId: string
): number | undefined {
    const definition = eventDefinition(eventId)
    const printed =
        challenge === AnomalyChallenge.Science
            ? definition.challenge?.science
            : definition.challenge?.combat
    if (printed === undefined) {
        return undefined
    }
    const abilities = factionAbilities(state, playerId)
    const modifier =
        challenge === AnomalyChallenge.Combat
            ? abilities.combatAnomalyDifficulty
            : abilities.scienceAnomalyDifficulty
    return printed + state.numPlayers + (modifier ?? 0)
}

export function eventAttemptShips(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    eventId: string,
    challenge: AnomalyChallenge
): ShipState[] {
    const active = activeEvent(state, eventId)
    if (!active) {
        return []
    }
    return state
        .shipsOf(playerId)
        .filter(
            (ship) =>
                ship.systemId === active.systemId &&
                hasArrived(ship) &&
                !ship.explored &&
                !isHeld(state, ship) &&
                !isCrippled(ship) &&
                anomalyStrength(ship, challenge) > 0
        )
}

export function isValidEventAttempt(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    eventId: string,
    challenge: AnomalyChallenge,
    shipIds: readonly string[]
): boolean {
    const difficulty = eventDifficulty(state, eventId, challenge, playerId)
    const player = state.getPlayerState(playerId)
    if (
        difficulty === undefined ||
        player.eventAttempts.some((attempt) => attempt.eventId === eventId)
    ) {
        return false
    }
    const available = eventAttemptShips(state, playerId, eventId, challenge)
    const chosen = available.filter((ship) => shipIds.includes(ship.shipId))
    return (
        shipIds.length > 0 &&
        new Set(shipIds).size === shipIds.length &&
        chosen.length === shipIds.length &&
        attemptStrength(chosen, challenge) >= difficulty
    )
}

export function attemptableEventIds(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): string[] {
    return state.events
        .filter((active) =>
            Object.values(AnomalyChallenge).some((challenge) =>
                isValidEventAttempt(
                    state,
                    playerId,
                    active.eventId,
                    challenge,
                    eventAttemptShips(state, playerId, active.eventId, challenge).map(
                        (ship) => ship.shipId
                    )
                )
            )
        )
        .map((active) => active.eventId)
}

export function commitEventAttempt(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    eventId: string,
    challenge: AnomalyChallenge,
    shipIds: readonly string[]
) {
    const active = activeEvent(state, eventId)
    assertExists(active, `Event ${eventId} is not on the map`)
    for (const shipId of shipIds) {
        state.ship(shipId).explored = true
    }
    state.getPlayerState(playerId).eventAttempts.push({
        eventId,
        systemId: active.systemId,
        challenge,
        shipIds: [...shipIds]
    })
}

export function anyEventAttempts(state: HydratedStellarHorizonsGameState): boolean {
    return state.players.some((player) => player.eventAttempts.length > 0)
}

export type EventResolution = Type.Static<typeof EventResolution>
export const EventResolution = Type.Object({
    playerId: Type.String(),
    eventId: Type.String(),
    systemId: Type.String(),
    challenge: Type.Enum(AnomalyChallenge),
    shipIds: Type.Array(Type.String()),
    pactId: Type.Optional(Type.String()),
    resolved: Type.Boolean(),
    influence: Type.Number(),
    shares: Type.Optional(Type.Record(Type.String(), Type.Number()))
})

// A pact on an event takes its pledged ships' actions and splits the IP as agreed.
function eventPactShares(
    state: HydratedStellarHorizonsGameState,
    pactId: string
): Record<string, number> {
    const candidate = state.pacts.find((other) => other.id === pactId)
    assertExists(candidate, `No pact ${pactId}`)
    state.pacts = state.pacts.filter((other) => other.id !== pactId)
    for (const shipIds of Object.values(candidate.terms.pledges)) {
        for (const shipId of shipIds) {
            const ship = state.findShip(shipId)
            if (ship) {
                ship.explored = true
            }
        }
    }
    return Object.fromEntries(
        Object.entries(candidate.terms.shares).map(([partnerId, share]) => [
            partnerId,
            share.influence
        ])
    )
}

// Attempts resolve in initiative order after the anomalies; the event returns to the pool and
// its IP goes to whoever resolved it.
export function resolveNextEventAttempt(state: HydratedStellarHorizonsGameState): EventResolution {
    const playerId = state
        .initiativeOrder()
        .find((candidate) => state.getPlayerState(candidate).eventAttempts.length > 0)
    assertExists(playerId, 'No event attempt to resolve')
    const player = state.getPlayerState(playerId)
    const [attempt, ...remaining] = player.eventAttempts
    player.eventAttempts = remaining
    const resolved = activeEvent(state, attempt.eventId) !== undefined
    const influence = resolved ? eventDefinition(attempt.eventId).influence : 0
    const pactShares =
        attempt.pactId === undefined ? undefined : eventPactShares(state, attempt.pactId)
    if (resolved) {
        state.events = state.events.filter((candidate) => candidate.eventId !== attempt.eventId)
        state.eventPool.push(attempt.eventId)
        for (const [partnerId, share] of Object.entries(pactShares ?? { [playerId]: influence })) {
            gainInfluence(state, partnerId, share)
        }
    }
    return {
        playerId,
        ...attempt,
        resolved,
        influence,
        ...(pactShares ? { shares: pactShares } : {})
    }
}
