import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus } from '@tabletop/common'
import { Definition, StellarHorizonsRuntime, type ShipState } from '@tabletop/stellar-horizons-2'
import { systemSummary } from './systemSummary.js'

const engine = new GameEngine(StellarHorizonsRuntime)

function startedState() {
    const game = StellarHorizonsRuntime.initializer.initializeGame(
        {
            id: 'summary',
            typeId: Definition.info.id,
            ownerId: 'owner',
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

function ship(shipId: string, playerId: string, systemId: string, transit = 0): ShipState {
    return {
        shipId,
        playerId,
        systemId,
        transit,
        damage: 0,
        settlements: 0,
        loadedFromBase: false,
        explored: false
    }
}

describe('system summary', () => {
    it('has no fleets where nobody is present', () => {
        expect(systemSummary(startedState(), 'alpha-centauri', 'p0')).toEqual({
            name: 'Alpha Centauri',
            settlementGoal: 10,
            fleets: []
        })
    })

    it('lists each faction present with its base and ships, the viewer first', () => {
        const state = startedState()
        state.ships.push(
            ship('starfarers-kepler', 'p0', 'alpha-centauri'),
            ship('givers-humboldt', 'p1', 'alpha-centauri', 2),
            ship('givers-mendel', 'p1', 'sol')
        )
        state.bases.push({
            playerId: 'p1',
            systemId: 'alpha-centauri',
            settlements: 3,
            spent: 0,
            cloned: false
        })
        const { fleets } = systemSummary(state, 'alpha-centauri', 'p0')
        const mine = fleets.find((fleet) => fleet.playerId === 'p0')
        const theirs = fleets.find((fleet) => fleet.playerId === 'p1')
        expect(mine?.ships.map((ship) => ship.shipId)).toEqual(['starfarers-kepler'])
        expect(theirs?.settlements).toBe(3)
        expect(theirs?.ships.map((ship) => ship.shipId)).toEqual(['givers-humboldt'])
        expect(
            systemSummary(state, 'alpha-centauri', 'p1').fleets.map((fleet) => fleet.playerId)
        ).toEqual(['p1', 'p0'])
    })
})
