import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus } from '@tabletop/common'
import {
    Definition,
    Faction,
    StellarHorizonsRuntime,
    TechField,
    TurnStep,
    type HydratedStellarHorizonsGameState,
    type ShipState
} from '@tabletop/stellar-horizons-2'
import { factionConsole, standings } from './playerArea.js'

const engine = new GameEngine(StellarHorizonsRuntime)

function startedState(): HydratedStellarHorizonsGameState {
    const game = StellarHorizonsRuntime.initializer.initializeGame(
        {
            id: 'players',
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

describe('player area', () => {
    it('lists players in initiative order with their ships, settlements and cash', () => {
        const state = startedState()
        const [first, second] = state.initiativeOrder()
        state.getPlayerState(first).faction = Faction.Starfarers
        state.ships.push(
            ship('starfarers-kepler', first, 'sol'),
            ship('starfarers-copernicus', first, 'alpha-centauri', 2),
            ship('starfarers-andromeda', first, 'sol')
        )
        state.bases.push(
            {
                playerId: first,
                systemId: 'alpha-centauri',
                settlements: 3,
                spent: 0,
                cloned: false
            },
            { playerId: first, systemId: 'luhman-16', settlements: 4, spent: 0, cloned: false }
        )
        const rows = standings(state)
        expect(rows.map((row) => row.playerId)).toEqual([first, second])
        expect(rows[0]).toMatchObject({
            faction: Faction.Starfarers,
            initiative: 1,
            explorers: 2,
            crewVehicles: 1,
            settlements: 7,
            cash: state.getPlayerState(first).cash
        })
        expect(rows[1]).toMatchObject({
            initiative: 2,
            explorers: 0,
            crewVehicles: 0,
            settlements: 0
        })
    })

    it('shows a step only while turns are being played', () => {
        const state = startedState()
        const rows = standings(state)
        expect(rows.every((row) => row.step === undefined)).toBe(true)
    })

    it('describes one player for the console', () => {
        const state = startedState()
        const [first] = state.initiativeOrder()
        const player = state.getPlayerState(first)
        player.faction = Faction.Starfarers
        player.step = TurnStep.Development
        player.fieldsDeveloped = [TechField.Physics]
        state.ships.push(
            ship('starfarers-copernicus', first, 'alpha-centauri', 2),
            ship('starfarers-kepler', first, 'alpha-centauri'),
            ship('starfarers-andromeda', first, 'sol')
        )
        state.bases.push(
            {
                playerId: first,
                systemId: 'alpha-centauri',
                settlements: 3,
                spent: 0,
                cloned: false
            },
            { playerId: first, systemId: 'luhman-16', settlements: 4, spent: 0, cloned: false }
        )
        const view = factionConsole(state, first)
        expect(view?.bases.map((base) => [base.systemId, base.settlements])).toEqual([
            ['luhman-16', 4],
            ['alpha-centauri', 3]
        ])
        expect(view?.settlementGoal).toBe(10)
        expect(view?.populationGoal).toBe(25)
        const centauri = view?.fleet.find((group) => group.systemId === 'alpha-centauri')
        expect(centauri?.ships.map((entry) => entry.shipId)).toEqual([
            'starfarers-kepler',
            'starfarers-copernicus'
        ])
        expect(view?.fleet.map((group) => group.systemId).toSorted()).toEqual([
            'alpha-centauri',
            'sol'
        ])
        const physics = view?.techs.find((progress) => progress.field === TechField.Physics)
        expect(physics?.developedThisTurn).toBe(true)
        expect(physics?.developed).toBe(
            player.techs.length -
                (view?.techs
                    .filter((progress) => progress.field !== TechField.Physics)
                    .reduce((total, progress) => total + progress.developed, 0) ?? 0)
        )
        expect(factionConsole(state, 'nobody')).toBeUndefined()
    })
})
