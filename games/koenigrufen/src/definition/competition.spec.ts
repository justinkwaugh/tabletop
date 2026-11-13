import { assert, GameEngine, validateGameResult } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Contract } from '../components/contracts.js'
import { KoenigrufenGameStateValidator } from '../model/gameState.js'
import {
    createGame,
    createTestSession,
    declareByMeinSpiel,
    playOutHand,
    TestMasterSeed
} from '../util/testHelper.js'
import { ActionType } from './actions.js'
import { TimesAround } from './config.js'
import { KoenigrufenRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(KoenigrufenRuntime)

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

function startAssigned(order: string[], timesAround: TimesAround = TimesAround.Three) {
    const game = createGame({ timesAround })
    const { initialState, startedGame } = engine.startGame(game, {
        masterSeed: TestMasterSeed,
        startingPositions: { playerIds: order }
    })
    return { startedGame, session: createTestSession(startedGame, initialState) }
}

// Every option changes only how many hands are dealt, never the setup or who acts first.
describe.each(Object.values(TimesAround))(
    'Königrufen tournaments, %s times around',
    (timesAround) => {
        it('makes seat one Forehand, the first to bid, and the later seats bid in order', () => {
            const players = createGame().players.map((player) => player.id)
            for (const order of [...rotations(players), ...rotations(players.toReversed())]) {
                const { startedGame, session } = startAssigned(order, timesAround)
                expect(startedGame.protectedInformation).toBe(true)
                expect(session.state.turnManager.turnOrder).toEqual(order)
                // The last seat deals, so the first seat is Forehand.
                expect(session.state.dealerId).toBe(order[3])
                expect(session.state.machineState).toBe(MachineState.Bidding)
                const bidders: string[] = []
                while (session.state.machineState === MachineState.Bidding) {
                    const playerId = session.activePlayerId()
                    bidders.push(playerId)
                    session.act(
                        playerId,
                        playerId === order[0] ? ActionType.SayMeinSpiel : ActionType.Pass
                    )
                }
                expect(bidders).toEqual(order)
            }
        })

        it('keeps the ordinary seeded setup, seat by seat, and projects it for every Perspective', () => {
            const game = createGame({ timesAround })
            const uninitialized = engine.generateUninitializedState(game, TestMasterSeed)
            const initialize = (playerIds?: string[]) =>
                KoenigrufenRuntime.initializer
                    .initializeGameState(
                        game,
                        structuredClone(uninitialized),
                        playerIds ? { playerIds } : undefined
                    )
                    .dehydrate()
            const normal = initialize()
            expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)
            for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
                const assigned = initialize(order)
                expect(initialize(order)).toEqual(assigned)
                assert(KoenigrufenGameStateValidator.Check(assigned), 'Setup must be canonical')
                expect(assigned.turnManager.turnOrder).toEqual(order)
                // Each seat is dealt what that seat is dealt in the ordinary game, and every player
                // keeps their colour.
                expect(assigned.players.map((player) => player.hand)).toEqual(
                    normal.players.map((player) => player.hand)
                )
                for (const player of assigned.players) {
                    expect(player.color).toBe(
                        normal.players.find((other) => other.playerId === player.playerId)?.color
                    )
                }
                expect({
                    ...assigned,
                    turnManager: normal.turnManager,
                    dealerId: normal.dealerId,
                    players: normal.players
                }).toEqual(normal)
                for (const perspective of [
                    { kind: 'spectator' } as const,
                    ...order.map((playerId) => ({ kind: 'player', playerId }) as const)
                ]) {
                    const view = KoenigrufenRuntime.visibility.state.project(
                        assigned,
                        perspective,
                        {
                            config: game.config
                        }
                    )
                    expect(view).not.toHaveProperty('masterSeed')
                    expect(view).not.toHaveProperty('talon')
                    expect(view.turnManager.turnOrder).toEqual(order)
                    for (const player of view.players) {
                        const own =
                            perspective.kind === 'player' &&
                            perspective.playerId === player.playerId
                        expect(Object.hasOwn(player, 'hand')).toBe(own)
                    }
                    expect(() => KoenigrufenRuntime.hydrator.hydrateState(view)).not.toThrow()
                }
            }
        })
    }
)

describe('a finished tournament game', () => {
    it('records a result the host accepts and scores every player', () => {
        const order = createGame()
            .players.map((player) => player.id)
            .reverse()
        const { startedGame, session } = startAssigned(order, TimesAround.Two)
        while (session.state.machineState !== MachineState.EndOfGame) {
            declareByMeinSpiel(session, Contract.Rufer)
            playOutHand(session)
        }
        const finished = session.state
        assert(KoenigrufenGameStateValidator.Check(finished), 'Finished state must be canonical')
        expect(() => validateGameResult(finished)).not.toThrow()
        const finalScores = KoenigrufenRuntime.scoring.finalScores(finished)
        expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
        const best = Math.max(...Object.values(finalScores))
        expect(finished.winningPlayerIds.length).toBeGreaterThan(0)
        expect(finished.winningPlayerIds.every((playerId) => finalScores[playerId] === best)).toBe(
            true
        )
        const spectatorView = KoenigrufenRuntime.visibility.state.project(
            finished,
            { kind: 'spectator' },
            { config: startedGame.config }
        )
        expect(KoenigrufenRuntime.scoring.finalScores(spectatorView)).toEqual(finalScores)
    })
})
