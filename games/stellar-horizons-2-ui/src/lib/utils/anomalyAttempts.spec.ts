import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus } from '@tabletop/common'
import {
    Definition,
    ScenarioId,
    StellarHorizonsRuntime,
    type HydratedStellarHorizonsGameState,
    type ShipState
} from '@tabletop/stellar-horizons-2'
import { toggleAnomalyShip } from '$lib/model/selection.js'
import { anomalyOpportunities } from './anomalyAttempts.js'
import { standings } from './playerArea.js'

const engine = new GameEngine(StellarHorizonsRuntime)

function voyages(): HydratedStellarHorizonsGameState {
    const game = StellarHorizonsRuntime.initializer.initializeGame(
        {
            id: 'anomalies',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config: { scenario: ScenarioId.Voyages },
            players: [0, 1].map((index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { initialState } = engine.startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef'
    })
    return StellarHorizonsRuntime.hydrator.hydrateState(initialState)
}

function ship(shipId: string, playerId: string, systemId: string): ShipState {
    return {
        shipId,
        playerId,
        systemId,
        transit: 0,
        damage: 0,
        settlements: 0,
        loadedFromBase: false,
        explored: false
    }
}

describe('anomaly opportunities', () => {
    it('list each anomaly the player has ships at, with what the chosen ships add up to', () => {
        const state = voyages()
        const [first, second] = state.initiativeOrder()
        state.systemState('vega').anomaly = 'stellar-chart'
        state.systemState('altair').anomaly = 'pirate-lair'
        state.ships.push(
            ship('starfarers-orion', first, 'vega'),
            ship('starfarers-kuiper', first, 'vega'),
            ship('givers-darwin', second, 'altair')
        )
        const [opportunity, ...others] = anomalyOpportunities(state, first, {
            systemId: 'vega',
            shipIds: ['starfarers-orion']
        })
        expect(others).toEqual([])
        expect(opportunity.systemId).toBe('vega')
        expect(opportunity.summary.difficulty).toBe(6)
        expect(
            opportunity.ships.map((entry) => [entry.ship.shipId, entry.strength, entry.chosen])
        ).toEqual([
            ['starfarers-orion', 6, true],
            ['starfarers-kuiper', 2, false]
        ])
        expect(opportunity.chosenStrength).toBe(6)
        expect(opportunity.availableStrength).toBe(8)
        expect(opportunity.committedShipIds).toBeUndefined()
    })

    it('show the player’s own commitment and who else has committed, and in which order', () => {
        const state = voyages()
        const [first, second] = state.initiativeOrder()
        state.systemState('vega').anomaly = 'stellar-chart'
        state.ships.push(
            { ...ship('starfarers-orion', first, 'vega'), explored: true },
            { ...ship('givers-darwin', second, 'vega'), explored: true },
            ship('givers-mendel', second, 'vega')
        )
        state.pendingAnomalyAttempts.push(
            {
                playerId: first,
                systemId: 'vega',
                anomalyId: 'stellar-chart',
                shipIds: ['starfarers-orion']
            },
            {
                playerId: second,
                systemId: 'vega',
                anomalyId: 'stellar-chart',
                shipIds: ['givers-darwin']
            }
        )
        const [mine] = anomalyOpportunities(state, first, undefined)
        expect(mine.committedShipIds).toEqual(['starfarers-orion'])
        expect(mine.ships).toEqual([])
        expect(mine.rivals).toEqual([{ playerId: second, resolvesFirst: false }])

        const [theirs] = anomalyOpportunities(state, second, undefined)
        expect(theirs.rivals).toEqual([{ playerId: first, resolvesFirst: true }])
    })
})

describe('choosing ships for an anomaly', () => {
    it('adds and removes ships, and starts over at another anomaly', () => {
        const one = toggleAnomalyShip(undefined, 'vega', 'a')
        expect(one).toEqual({ systemId: 'vega', shipIds: ['a'] })
        const two = toggleAnomalyShip(one, 'vega', 'b')
        expect(two).toEqual({ systemId: 'vega', shipIds: ['a', 'b'] })
        expect(toggleAnomalyShip(two, 'vega', 'a')).toEqual({ systemId: 'vega', shipIds: ['b'] })
        expect(toggleAnomalyShip(one, 'vega', 'a')).toBeUndefined()
        expect(toggleAnomalyShip(two, 'altair', 'c')).toEqual({
            systemId: 'altair',
            shipIds: ['c']
        })
    })
})

describe('anomaly standings', () => {
    it('count each player’s science and combat anomalies against the goal', () => {
        const state = voyages()
        const [first] = state.initiativeOrder()
        state.getPlayerState(first).anomalies = ['ice-caverns', 'pirate-lair', 'megafauna']
        const [row, other] = standings(state)
        expect(row.anomalies).toMatchObject({ science: 1, combat: 2 })
        expect(row.anomalies?.goal.resolved).toBe(4)
        expect(other.anomalies).toMatchObject({ science: 0, combat: 0 })
    })
})
