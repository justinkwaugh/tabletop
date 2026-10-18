import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import { HydratedDrawEvent } from '../actions/drawEvent.js'
import { AnomalyChallenge } from '../components/anomalies.js'
import { Faction } from '../components/factions.js'
import { ScenarioId } from '../components/scenarios.js'
import { TechId, techDefinition } from '../components/techs.js'
import { WorldClass, WorldSide, worldTile } from '../components/worlds.js'
import { ActionType } from '../definition/actions.js'
import { techCost } from './development.js'
import { producingBases } from './economy.js'
import {
    applyEachTurnEffects,
    eventDifficulty,
    eventPlacer,
    extraEarthMarkers,
    isValidEventAttempt,
    commitEventAttempt,
    releaseAbandonedEvents,
    resolveNextEventAttempt,
    triggerNextEventEffects
} from './events.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { hydrate, placeBase, placeShip, startedGame } from '../testing/fixtures.js'

const SYSTEM = 'alpha-centauri'

function campaign(): HydratedStellarHorizonsGameState {
    const state = hydrate(startedGame(3, { scenario: ScenarioId.Campaign }).state)
    for (const pool of [state.worldPool, state.setAsideWorlds]) {
        if (pool.includes('m-1')) pool.splice(pool.indexOf('m-1'), 1)
    }
    state.systemState(SYSTEM).worlds = [{ tileId: 'm-1', side: WorldSide.I }]
    return state
}

function drawFixed(state: HydratedStellarHorizonsGameState, eventId: string) {
    state.eventPool = [eventId]
    const action = new HydratedDrawEvent({
        id: `draw-${eventId}`,
        gameId: state.gameId,
        source: ActionSource.System,
        type: ActionType.DrawEvent
    })
    action.apply(state)
    assertExists(action.metadata)
    return action.metadata
}

function playerOf(state: HydratedStellarHorizonsGameState, faction: Faction) {
    const player = state.players.find((candidate) => candidate.faction === faction)
    assertExists(player)
    return player.playerId
}

describe('Events without a challenge', () => {
    it('Breakthrough halves one tech of its type for the Players with the fewest of them', () => {
        const state = campaign()
        const [first, second, third] = state.initiativeOrder()
        state
            .getPlayerState(first)
            .techs.push({ techId: TechId.InterstellarSettlement, year: 2090 })
        const drawn = drawFixed(state, 'breakthrough-biology').drawn
        expect(drawn?.players).toEqual([second, third])
        const printed = techDefinition(TechId.Terraforming).cost
        expect(techCost(state, second, TechId.Terraforming)).toBe(
            Math.max(5, Math.ceil(printed / 2))
        )
        expect(techCost(state, first, TechId.Terraforming)).toBe(printed)
        expect(state.eventPool).toEqual(['breakthrough-biology'])
    })

    it('Colonial Rush adds a settlement to each base of the Players with the fewest settlements', () => {
        const state = campaign()
        const [first, second] = state.initiativeOrder()
        placeBase(state, first, SYSTEM, 6)
        placeBase(state, second, 'barnards-star', 2)
        placeBase(state, second, 'luhman-16', 1)
        expect(drawFixed(state, 'colonial-rush').drawn?.players).toEqual([second])
        expect(state.base(second, 'barnards-star')?.settlements).toBe(3)
        expect(state.base(second, 'luhman-16')?.settlements).toBe(2)
        expect(state.base(first, SYSTEM)?.settlements).toBe(6)
    })

    it('Homesteaders leaves the favoured Players to choose a base', () => {
        const state = campaign()
        const [, second] = state.initiativeOrder()
        placeBase(state, second, SYSTEM, 1)
        drawFixed(state, 'homesteaders')
        expect(state.homesteaders).toEqual([second])
    })

    it('Colonial Rush and Homesteaders pass over bases where a "no bases" anomaly lies', () => {
        const state = campaign()
        const [first, second] = state.initiativeOrder()
        state.anomalyPool.splice(state.anomalyPool.indexOf('megafauna'), 1)
        state.systemState(SYSTEM).anomaly = 'megafauna'
        placeBase(state, first, 'barnards-star', 9)
        placeBase(state, second, 'barnards-star', 2)
        placeBase(state, second, SYSTEM, 1)
        drawFixed(state, 'colonial-rush')
        expect(state.base(second, 'barnards-star')?.settlements).toBe(3)
        expect(state.base(second, SYSTEM)?.settlements).toBe(1)

        const blocked = campaign()
        const [, onlyBlocked] = blocked.initiativeOrder()
        blocked.anomalyPool.splice(blocked.anomalyPool.indexOf('megafauna'), 1)
        blocked.systemState(SYSTEM).anomaly = 'megafauna'
        placeBase(blocked, onlyBlocked, SYSTEM, 1)
        drawFixed(blocked, 'homesteaders')
        expect(blocked.homesteaders).toEqual([])
    })
})

describe('Event challenges', () => {
    it('are placed by the Player with the worst initiative who has a base', () => {
        const state = campaign()
        const [first, second] = state.initiativeOrder()
        expect(drawFixed(state, 'pirate-raids-3').placerId).toBeUndefined()
        expect(state.eventPool).toEqual(['pirate-raids-3'])
        placeBase(state, first, SYSTEM, 2)
        placeBase(state, second, 'barnards-star', 2)
        expect(eventPlacer(state)).toBe(second)
        expect(drawFixed(state, 'pirate-raids-3').placerId).toBe(second)
        expect(state.eventPlacement).toEqual({ eventId: 'pirate-raids-3', playerId: second })
    })

    it('act each turn on the Players with bases in the system', () => {
        const state = campaign()
        const [first] = state.initiativeOrder()
        placeBase(state, first, SYSTEM, 2)
        state.events = [{ eventId: 'pirate-raids-3', systemId: SYSTEM }]
        const cash = state.getPlayerState(first).cash
        applyEachTurnEffects(state)
        expect(state.getPlayerState(first).cash).toBe(cash - 1)
    })

    it('act when the next event is drawn, then return to the pool', () => {
        const state = campaign()
        const [first] = state.initiativeOrder()
        placeBase(state, first, SYSTEM, 7)
        state.events = [
            { eventId: 'hostile-probe', systemId: SYSTEM },
            { eventId: 'supervolcano', systemId: SYSTEM }
        ]
        state.eventPool = state.eventPool.filter(
            (eventId) => eventId !== 'hostile-probe' && eventId !== 'supervolcano'
        )
        triggerNextEventEffects(state)
        expect(state.base(first, SYSTEM)?.settlements).toBe(4)
        expect(worldTile(state.systemState(SYSTEM).worlds[0].tileId).worldClass).toBe(WorldClass.A)
        expect(state.events).toEqual([])
        expect(state.eventPool).toContain('hostile-probe')
    })

    it('Unrest stops base production; First Contact adds an Earth marker of each type', () => {
        const state = campaign()
        const [first] = state.initiativeOrder()
        placeBase(state, first, SYSTEM, 2)
        state.events = [{ eventId: 'unrest', systemId: SYSTEM }]
        expect(producingBases(state, first)).toEqual([])
        state.events.push({ eventId: 'first-contact', systemId: SYSTEM })
        expect(extraEarthMarkers(state)).toBe(1)
    })

    it('leave when their system has no base left', () => {
        const state = campaign()
        state.events = [{ eventId: 'unrest', systemId: SYSTEM }]
        expect(releaseAbandonedEvents(state)).toEqual(['unrest'])
        expect(state.events).toEqual([])
    })

    it('are resolved like anomalies for their IP, AI Sentient Emergence either way', () => {
        const state = campaign()
        const starfarers = playerOf(state, Faction.Starfarers)
        placeBase(state, starfarers, SYSTEM, 2)
        state.events = [{ eventId: 'ai-sentient-emergence', systemId: SYSTEM }]
        // Science 7 + 3 players - 1 for the Starfarers; combat 9 + 3.
        expect(
            eventDifficulty(state, 'ai-sentient-emergence', AnomalyChallenge.Science, starfarers)
        ).toBe(9)
        expect(
            eventDifficulty(state, 'ai-sentient-emergence', AnomalyChallenge.Combat, starfarers)
        ).toBe(12)
        const comet = placeShip(state, starfarers, 'starfarers-comet', SYSTEM)
        expect(
            isValidEventAttempt(
                state,
                starfarers,
                'ai-sentient-emergence',
                AnomalyChallenge.Combat,
                [comet.shipId]
            )
        ).toBe(true)
        commitEventAttempt(state, starfarers, 'ai-sentient-emergence', AnomalyChallenge.Combat, [
            comet.shipId
        ])
        const influence = state.getPlayerState(starfarers).influence
        const resolution = resolveNextEventAttempt(state)
        expect(resolution.resolved).toBe(true)
        expect(state.getPlayerState(starfarers).influence).toBe(influence + 6)
        expect(state.events).toEqual([])
        expect(state.eventPool).toContain('ai-sentient-emergence')
    })
})
