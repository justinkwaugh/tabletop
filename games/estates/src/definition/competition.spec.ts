import {
    assert,
    GameEngine,
    GameResult,
    MachineContext,
    validateGameResult
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { EstatesGameStateValidator } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { EstatesRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { createGame, play, playToEnd } from './tests/playthrough.js'

const engine = new GameEngine(EstatesRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

describe.each([2, 3, 4, 5])('Estates tournaments with %i players', (count) => {
    it('honors every starting seat through the first round of auctions', () => {
        const game = createGame(count)
        for (const order of rotations(game.players.map((player) => player.id))) {
            const { initialState, startedGame } = engine.startGame(game, {
                masterSeed,
                startingPositions: { playerIds: order }
            })
            expect(startedGame.protectedInformation).toBe(true)
            expect(initialState.turnManager.turnOrder).toEqual(order)
            const session = play(game, initialState)
            for (const [seat, auctioneer] of order.entries()) {
                expect(session.state.machineState).toBe(MachineState.StartOfTurn)
                expect(session.state.activePlayerIds).toEqual([auctioneer])
                session.offerCube()
                const bidders: string[] = []
                while (session.state.machineState === MachineState.Auctioning) {
                    bidders.push(session.state.activePlayerIds[0])
                    session.act(ActionType.PlaceBid, { amount: 0 })
                }
                expect(bidders).toEqual([...order.slice(seat + 1), ...order.slice(0, seat)])
                session.placeCube()
            }
            expect(session.state.activePlayerIds).toEqual([order[0]])
        }
    })

    it.each([false, true])(
        'preserves ordinary seeded setup and protected projections (hiddenMoney %s)',
        (hiddenMoney) => {
            const game = createGame(count, { hiddenMoney })
            const uninitialized = engine.generateUninitializedState(game, masterSeed)
            const initialize = (playerIds?: string[]) =>
                EstatesRuntime.initializer
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
                expect(assigned.turnManager.turnOrder).toEqual(order)
                expect({ ...assigned, turnManager: normal.turnManager }).toEqual(normal)
                assert(EstatesGameStateValidator.Check(assigned), 'Setup must be canonical')
                for (const perspective of [
                    { kind: 'spectator' } as const,
                    ...order.map((playerId) => ({ kind: 'player', playerId }) as const)
                ]) {
                    const view = EstatesRuntime.visibility.state.project(assigned, perspective, {
                        config: game.config
                    })
                    expect(view).not.toHaveProperty('masterSeed')
                    expect(view.roofs).toEqual({ items: [], remaining: 12 })
                    expect(view.protectedPrng).toEqual({ seed: 0, invocations: 0 })
                    expect(view.turnManager.turnOrder).toEqual(order)
                    for (const player of view.players) {
                        const entitled =
                            !hiddenMoney ||
                            (perspective.kind === 'player' &&
                                perspective.playerId === player.playerId)
                        for (const field of ['money', 'stolen', 'score'])
                            expect(Object.hasOwn(player, field)).toBe(entitled)
                    }
                    expect(() => EstatesRuntime.hydrator.hydrateState(view)).not.toThrow()
                }
            }
        }
    )

    it('scores every player from an actual finished assigned game', () => {
        const game = createGame(count, { hiddenMoney: true })
        const order = game.players.map((player) => player.id).reverse()
        const { initialState } = engine.startGame(game, {
            masterSeed,
            startingPositions: { playerIds: order }
        })
        const finished = playToEnd(game, initialState)
        assert(EstatesGameStateValidator.Check(finished), 'Finished state must be canonical')
        expect(() => validateGameResult(finished)).not.toThrow()
        const finalScores = EstatesRuntime.scoring.finalScores(finished)
        expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
        expect(finalScores).toEqual(
            Object.fromEntries(finished.players.map((player) => [player.playerId, player.score]))
        )
        const best = Math.max(...Object.values(finalScores))
        expect(finished.winningPlayerIds.every((playerId) => finalScores[playerId] === best)).toBe(
            true
        )
        const spectatorView = EstatesRuntime.visibility.state.project(
            finished,
            { kind: 'spectator' },
            { config: game.config }
        )
        expect(EstatesRuntime.scoring.finalScores(spectatorView)).toEqual(finalScores)
        expect(spectatorView.roofs.items).toEqual([])
    })
})

describe('Estates terminal results', () => {
    it.each([
        { scores: [9, 4, 2, 0], money: [0, 0, 0, 0], winners: ['p0'] },
        { scores: [9, 9, 2, 0], money: [5, 3, 0, 0], winners: ['p0'] },
        { scores: [9, 9, 2, 0], money: [5, 5, 9, 0], winners: ['p0', 'p1'] },
        { scores: [3, 3, 3, 3], money: [1, 1, 1, 1], winners: ['p0', 'p1', 'p2', 'p3'] }
    ])('declares winners for scores $scores and money $money', ({ scores, money, winners }) => {
        const game = createGame(4)
        const state = EstatesRuntime.hydrator.hydrateState(
            engine.startGame(game, {
                masterSeed,
                startingPositions: { playerIds: ['p3', 'p2', 'p1', 'p0'] }
            }).initialState
        )
        state.players.forEach((player, index) => {
            player.score = scores[index]
            player.money = money[index]
            player.stolen = 0
        })
        state.machineState = MachineState.EndOfGame
        EstatesRuntime.stateHandlers[MachineState.EndOfGame].enter(
            new MachineContext({ gameState: state, gameConfig: game.config })
        )
        expect(state.result).toBe(winners.length === 1 ? GameResult.Win : GameResult.Draw)
        expect(state.winningPlayerIds).toEqual(winners)
        expect(() => validateGameResult(state.dehydrate())).not.toThrow()
        expect(EstatesRuntime.scoring.finalScores(state.dehydrate())).toEqual({
            p0: scores[0],
            p1: scores[1],
            p2: scores[2],
            p3: scores[3]
        })
    })
})
