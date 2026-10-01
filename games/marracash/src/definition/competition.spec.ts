import { GameEngine, validateGameResult } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { MarracashGameStateValidator } from '../model/gameState.js'
import { routesFrom, Shops } from '../components/board.js'
import { QueueEnd } from '../components/visitors.js'
import {
    createGame,
    createTestSession,
    TestMasterSeed,
    type TestSession
} from '../util/testHelper.js'
import { MachineState } from './states.js'
import { MarracashRuntime } from './runtime.js'

const engine = new GameEngine(MarracashRuntime)

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

describe.each([3, 4])('MarraCash tournaments with %i players', (count) => {
    it('seats players in the assigned order with position zero starting', () => {
        const game = createGame(count)
        for (const order of rotations(game.players.map((player) => player.id))) {
            const { initialState } = engine.startGame(game, {
                masterSeed: TestMasterSeed,
                startingPositions: { playerIds: order }
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.activePlayerIds).toEqual([order[0]])
        }
    })

    it('lets every seat auction once, in order, through the first round', () => {
        const game = createGame(count)
        for (const order of rotations(game.players.map((player) => player.id))) {
            const { initialState } = engine.startGame(game, {
                masterSeed: TestMasterSeed,
                startingPositions: { playerIds: order }
            })
            const session = createTestSession(game, initialState)
            order.forEach((auctioneer, seat) => {
                expect(session.state.machineState).toBe(MachineState.ChoosingAction)
                expect(session.state.activePlayerIds).toEqual([auctioneer])
                session.startAuction(auctioneer, Shops[seat].id)
                expect(session.state.activePlayerIds.toSorted()).toEqual(order.toSorted())
                for (const bidder of order) {
                    session.bid(bidder, bidder === auctioneer ? 100 : 0)
                }
            })
            expect(session.state.round).toBe(2)
            expect(session.state.activePlayerIds).toEqual([order[0]])
        }
    })

    it('changes nothing but the seating when positions are assigned', () => {
        const game = createGame(count)
        const uninitialized = engine.generateUninitializedState(game, TestMasterSeed)
        const initialize = (playerIds?: string[]) =>
            MarracashRuntime.initializer
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
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect({ ...assigned, turnManager: normal.turnManager }).toEqual(normal)
            expect(MarracashGameStateValidator.Check(assigned)).toBe(true)
        }
    })
})

function playToEnd(session: TestSession) {
    for (
        let step = 0;
        step < 5000 && session.state.machineState !== MachineState.EndOfGame;
        step++
    ) {
        const state = session.hydrated()
        const playerId = session.currentPlayerId()
        switch (state.machineState) {
            case MachineState.ChoosingAction: {
                const start = state.fountains.find((fountain) => fountain.visitors.length > 0)
                if (state.canMoveVisitors() && start) {
                    session.move(
                        playerId,
                        start.fountainId,
                        routesFrom(start.fountainId)[0].direction
                    )
                } else {
                    const shop = state.shops.find((candidate) => candidate.ownerId === undefined)
                    if (!shop) throw Error('Expected an unowned shop to auction')
                    session.startAuction(playerId, shop.shopId)
                }
                break
            }
            case MachineState.Bidding: {
                const auction = state.auction
                if (!auction) throw Error('Expected an auction')
                for (const bidder of [...state.activePlayerIds]) {
                    session.bid(bidder, bidder === auction.auctioneerId ? 100 : 0)
                }
                break
            }
            case MachineState.RefillingEntrances: {
                const count =
                    state.queue.length < 2 ? state.queue.length : Math.min(4, state.queue.length)
                session.bringVisitors(playerId, QueueEnd.Front, count, state.emptyEntranceIds()[0])
                break
            }
        }
    }
    expect(session.state.machineState).toBe(MachineState.EndOfGame)
    return session.state
}

describe.each([3, 4])('MarraCash finished tournament games with %i players', (count) => {
    it.each([true, false])('scores every player (antique cards %s)', (antiqueCards) => {
        const game = createGame(count, { antiqueCards, concealedCash: true })
        const order = game.players.map((player) => player.id).reverse()
        const { initialState } = engine.startGame(game, {
            masterSeed: TestMasterSeed,
            startingPositions: { playerIds: order }
        })
        const finished = playToEnd(createTestSession(game, initialState))

        expect(MarracashGameStateValidator.Check(finished)).toBe(true)
        expect(() => validateGameResult(finished)).not.toThrow()
        expect(finished.queue).toEqual([])
        const finalScores = MarracashRuntime.scoring.finalScores(finished)
        expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
        const best = Math.max(...Object.values(finalScores))
        expect(finished.winningPlayerIds.every((playerId) => finalScores[playerId] === best)).toBe(
            true
        )
    })
})
