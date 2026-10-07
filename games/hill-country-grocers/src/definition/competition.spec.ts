import { describe, expect, it } from 'vitest'
import { GameEngine, assert, validateGameResult } from '@tabletop/common'
import { HcgGameStateValidator, type HcgGameState } from '../model/gameState.js'
import { botAction, createGame } from '../testing/bot.js'
import { HcgRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(HcgRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

// Seat order decides the player array, the turn manager and who opens the first auction;
// everything else must match an unassigned game with the same seed.
function orderIndependent(state: HcgGameState) {
    const { players, turnManager, auction, activePlayerIds, ...rest } = state
    return {
        ...rest,
        players: players.toSorted((a, b) => a.playerId.localeCompare(b.playerId)),
        auctionCompany: auction?.companyId,
        turnSeries: turnManager.series,
        orderBound: [turnManager.turnOrder.length, activePlayerIds.length]
    }
}

function playToEnd(game: ReturnType<typeof createGame>, initialState: HcgGameState): HcgGameState {
    let state = initialState
    for (let step = 0; state.result === undefined; step++) {
        assert(step < 5000, 'The assigned game did not finish')
        const hydrated = HcgRuntime.hydrator.hydrateState(state)
        state = engine.executeCanonicalAction({
            game,
            state,
            action: botAction(hydrated, state.activePlayerIds[0], step)
        }).updatedState
    }
    return HcgRuntime.hydrator.hydrateState(state).dehydrate()
}

describe.each([3, 4, 5])('Hill Country Grocers tournaments with %i players', (count) => {
    it('opens the first auction with seat one and bids in the assigned order', () => {
        const game = createGame(count)
        for (const order of rotations(game.players.map((player) => player.id))) {
            const { initialState } = engine.startGame(game, {
                masterSeed,
                startingPositions: { playerIds: order }
            })
            const state = HcgRuntime.hydrator.hydrateState(initialState)
            expect(state.turnManager.turnOrder).toEqual(order)
            expect(state.machineState).toBe(MachineState.Bidding)
            expect(state.activePlayerIds).toEqual([order[0]])
            expect(state.auction?.bidding.auctioneerId).toBe(order[0])
            expect(
                state.auction?.bidding.participants.map((participant) => participant.playerId)
            ).toEqual(order)
        }
    })

    it('keeps ordinary seeded setup for every assigned order', () => {
        const game = createGame(count)
        const uninitialized = engine.generateUninitializedState(game, masterSeed)
        const initialize = (playerIds?: string[]) =>
            HcgRuntime.initializer
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
            expect(orderIndependent(assigned)).toEqual(orderIndependent(normal))
            assert(HcgGameStateValidator.Check(assigned), 'Setup must be canonical')
        }
    })

    it('scores every player from a finished assigned game', () => {
        const game = createGame(count)
        const order = game.players.map((player) => player.id).reverse()
        const { initialState } = engine.startGame(game, {
            masterSeed,
            startingPositions: { playerIds: order }
        })
        const finished = playToEnd(game, initialState)
        assert(HcgGameStateValidator.Check(finished), 'Finished state must be canonical')
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        expect(() => validateGameResult(finished)).not.toThrow()
        const finalScores = HcgRuntime.scoring.finalScores(finished)
        expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
        const best = Math.max(...Object.values(finalScores))
        expect(finished.winningPlayerIds.every((playerId) => finalScores[playerId] === best)).toBe(
            true
        )
    })
})
