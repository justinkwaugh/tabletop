import { assert, assertExists, GameEngine, validateGameResult } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { CoralColor } from '../components/colors.js'
import {
    ReefEncounterGameStateValidator,
    type ReefEncounterProjectedState
} from '../model/gameState.js'
import {
    createGame,
    createTestSession,
    dealtColorOf,
    TestMasterSeed,
    type TestGame
} from '../util/testHelper.js'
import type { ReefEncounterGameConfig } from './config.js'
import { ReefEncounterRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(ReefEncounterRuntime)

const Configurations: Partial<ReefEncounterGameConfig>[] = [
    { advanced: false, concealed: false },
    { advanced: true, concealed: false },
    { advanced: false, concealed: true }
]

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

function startAssigned(game: TestGame, order: string[]) {
    const { initialState, startedGame } = engine.startGame(game, {
        masterSeed: TestMasterSeed,
        startingPositions: { playerIds: order }
    })
    return createTestSession(startedGame, initialState)
}

function initializer(game: TestGame) {
    const uninitialized = engine.generateUninitializedState(game, TestMasterSeed)
    return (playerIds?: string[]): ReefEncounterProjectedState =>
        ReefEncounterRuntime.initializer
            .initializeGameState(
                game,
                structuredClone(uninitialized),
                playerIds ? { playerIds } : undefined
            )
            .dehydrate()
}

// Everything a seat is dealt, without the player sitting there.
function seats(state: ReefEncounterProjectedState) {
    return state.players.map(({ playerId: _playerId, color: _color, ...seat }) => seat)
}

describe.each([2, 3, 4])('Reef Encounter tournaments with %i players', (count) => {
    it('lets seat one act first, and the later seats in their assigned order', () => {
        const game = createGame(count)
        for (const order of rotations(game.players.map((player) => player.id))) {
            const session = startAssigned(game, order)
            expect(session.state.turnManager.turnOrder).toEqual(order)

            const feeders: string[] = []
            while (session.state.machineState === MachineState.ChoosingParrotfishPolyp) {
                const playerId = session.currentPlayerId()
                feeders.push(playerId)
                session.feedParrotfish(playerId, dealtColorOf(session, playerId))
            }
            const choosers: string[] = []
            while (session.state.machineState === MachineState.ChoosingLarvaCubes) {
                const playerId = session.currentPlayerId()
                choosers.push(playerId)
                session.chooseLarvaCubes(playerId, [CoralColor.Pink, CoralColor.Grey])
            }
            const turns: string[] = []
            for (const _seat of order) {
                const playerId = session.currentPlayerId()
                turns.push(playerId)
                session.takeOpenSeaSpace(playerId, firstTakeableSpace(session.state))
            }

            expect(feeders).toEqual(order)
            expect(choosers).toEqual(order)
            expect(turns).toEqual(order)
            expect(session.currentPlayerId()).toBe(order[0])
        }
    })

    it.each(Configurations)('leaves the rest of setup as the seed made it (%o)', (config) => {
        const game = createGame(count, config)
        const initialize = initializer(game)
        const normal = initialize()
        expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)

        for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
            const assigned = initialize(order)
            assert(ReefEncounterGameStateValidator.Check(assigned), 'Setup must be canonical')
            expect(initialize(order)).toEqual(assigned)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(seats(assigned)).toEqual(seats(normal))
            for (const player of assigned.players) {
                const same = normal.players.find(
                    (candidate) => candidate.playerId === player.playerId
                )
                expect(player.color).toBe(same?.color)
            }
            expect({
                ...assigned,
                players: normal.players,
                turnManager: normal.turnManager
            }).toEqual(normal)
        }
    })

    it('records a result every player can be scored by at the end of an assigned game', () => {
        const game = createGame(count, { concealed: true })
        const order = game.players.map((player) => player.id).reverse()
        const session = startAssigned(game, order)
        for (const playerId of order) {
            session.feedParrotfish(playerId, dealtColorOf(session, playerId))
        }
        for (const playerId of order) {
            session.chooseLarvaCubes(playerId, [CoralColor.Pink, CoralColor.Grey])
        }
        for (
            let turn = 0;
            turn < 500 && session.state.machineState === MachineState.TakingTurn;
            turn++
        ) {
            session.takeOpenSeaSpace(session.currentPlayerId(), firstTakeableSpace(session.state))
        }

        const finished = session.state
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        assert(ReefEncounterGameStateValidator.Check(finished), 'The end must be canonical')
        expect(() => validateGameResult(finished)).not.toThrow()
        const finalScores = ReefEncounterRuntime.scoring.finalScores(finished)
        expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
        const best = Math.max(...Object.values(finalScores))
        expect(finished.winningPlayerIds.every((playerId) => finalScores[playerId] === best)).toBe(
            true
        )
        const spectatorView = ReefEncounterRuntime.visibility.state.project(
            finished,
            { kind: 'spectator' },
            { config: game.config }
        )
        expect(ReefEncounterRuntime.scoring.finalScores(spectatorView)).toEqual(finalScores)
    })
})

function firstTakeableSpace(state: ReefEncounterProjectedState): CoralColor {
    const space = state.openSea.find((candidate) => candidate.hasLarvaCube)
    assertExists(space, 'An open-sea space can be taken')
    return space.larvaColor
}
