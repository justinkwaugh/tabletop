import { GameEngine } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { MarracashGameStateValidator } from '../model/gameState.js'
import { Shops } from '../components/board.js'
import { createGame, createTestSession, TestMasterSeed } from '../util/testHelper.js'
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
