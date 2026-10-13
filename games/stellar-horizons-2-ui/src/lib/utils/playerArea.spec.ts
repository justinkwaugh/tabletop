import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus } from '@tabletop/common'
import {
    Definition,
    Faction,
    MachineState,
    StellarHorizonsRuntime,
    TechField,
    baseKey,
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

function place(state: HydratedStellarHorizonsGameState, ...ships: ShipState[]) {
    for (const entry of ships) {
        state.ships[entry.shipId] = entry
    }
}

function settle(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    settlements: number
) {
    state.bases[baseKey(playerId, systemId)] = {
        playerId,
        systemId,
        settlements,
        spent: 0,
        cloned: false
    }
}

describe('player area', () => {
    it('lists players in initiative order with their ships, settlements and cash', () => {
        const state = startedState()
        const [first, second] = state.initiativeOrder()
        state.getPlayerState(first).faction = Faction.Starfarers
        place(
            state,
            ship('starfarers-kepler', first, 'sol'),
            ship('starfarers-copernicus', first, 'alpha-centauri', 2),
            ship('starfarers-andromeda', first, 'sol')
        )
        settle(state, first, 'alpha-centauri', 3)
        settle(state, first, 'luhman-16', 4)
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

    it('shows a phase only while one is being played', () => {
        const state = startedState()
        const rows = standings(state)
        expect(rows.every((row) => row.phase === undefined)).toBe(true)
    })

    it('shows how far each player is through the phase in play', () => {
        const state = startedState()
        const [first, second] = state.initiativeOrder()
        state.machineState = MachineState.Building
        state.parallelSpan = {
            machineState: MachineState.BuildPhase,
            branchPoint: { actionCount: 0, actionChecksum: 0 },
            playerIds: [second, first],
            closedPlayerIds: [second],
            mergedPlayerIds: [second],
            branchPlayerId: first,
            branchStartIds: {},
            branchCloseIds: {},
            completionId: 'completion'
        }
        const rows = standings(state)
        expect(rows.map((row) => [row.playerId, row.phase?.phase, row.phase?.progress])).toEqual([
            [first, 'Build', 'playing'],
            [second, 'Build', 'done']
        ])
    })

    it('describes one player for the console', () => {
        const state = startedState()
        const [first] = state.initiativeOrder()
        const player = state.getPlayerState(first)
        player.faction = Faction.Starfarers
        player.fieldsDeveloped = [TechField.Physics]
        place(
            state,
            ship('starfarers-copernicus', first, 'alpha-centauri', 2),
            ship('starfarers-kepler', first, 'alpha-centauri'),
            ship('starfarers-andromeda', first, 'sol')
        )
        settle(state, first, 'alpha-centauri', 3)
        settle(state, first, 'luhman-16', 4)
        const view = factionConsole(state, first)
        expect(view?.bases.map((base) => [base.systemId, base.settlements])).toEqual([
            ['luhman-16', 4],
            ['alpha-centauri', 3]
        ])
        expect(view?.settlementGoal).toMatchObject({ settlements: 10, systemPopulation: 25 })
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
