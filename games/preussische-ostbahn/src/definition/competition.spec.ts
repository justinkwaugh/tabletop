import { describe, expect, it } from 'vitest'
import { ActionSource, assert, assertExists, validateGameResult } from '@tabletop/common'
import type { OstbahnGameState } from '../model/gameState.js'
import { OstbahnGameStateValidator } from '../model/gameState.js'
import { botAction } from '../testing/bot.js'
import { createGame, engine, masterSeed } from '../testing/table.js'
import { ActionType } from './actions.js'
import { OstbahnRuntime } from './runtime.js'
import { MachineState } from './states.js'

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

function byPlayer(state: OstbahnGameState) {
    return state.players.toSorted((a, b) => a.playerId.localeCompare(b.playerId))
}

function openingBidders(game: ReturnType<typeof createGame>, initial: OstbahnGameState) {
    let state = initial
    const bidders: string[] = []
    const railroadId = state.shareAuction?.railroadId
    while (state.shareAuction?.railroadId === railroadId) {
        const [playerId] = state.activePlayerIds
        assertExists(playerId, 'Someone bids in the first opening auction')
        bidders.push(playerId)
        const action = {
            id: `pass-${state.actionCount}`,
            gameId: state.gameId,
            source: ActionSource.User,
            playerId,
            type: ActionType.PassBid
        }
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    }
    return { bidders, state }
}

describe.each([3, 4, 5])('Preußische Ostbahn tournaments with %i players', (count) => {
    it('opens the first auction with seat one and bids in seat order', () => {
        const game = createGame(count)
        for (const order of rotations(game.players.map((player) => player.id))) {
            const { initialState } = engine.startGame(game, {
                masterSeed,
                startingPositions: { playerIds: order }
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.players.map((player) => player.playerId)).toEqual(order)
            expect(initialState.activePlayerIds).toEqual([order[0]])
            const { bidders, state } = openingBidders(game, initialState)
            expect(bidders).toEqual(order)
            expect(state.railroads[0].owners).toEqual([order[0]])
        }
    })

    it('leaves ordinary seeded setup unchanged apart from the seats', () => {
        const game = createGame(count)
        const uninitialized = engine.generateUninitializedState(game, masterSeed)
        const initialize = (playerIds?: string[]) =>
            OstbahnRuntime.initializer
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
            expect(byPlayer(assigned)).toEqual(byPlayer(normal))
            expect({
                ...assigned,
                players: byPlayer(assigned),
                turnManager: normal.turnManager,
                shareAuction: normal.shareAuction,
                activePlayerIds: normal.activePlayerIds
            }).toEqual({ ...normal, players: byPlayer(normal) })
            expect(assigned.shareAuction?.railroadId).toBe(normal.shareAuction?.railroadId)
            assert(OstbahnGameStateValidator.Check(assigned), 'Setup must be canonical')
        }
    })

    it('scores every player from an actual finished assigned game', () => {
        const game = createGame(count)
        const order = game.players.map((player) => player.id).reverse()
        let state: OstbahnGameState = engine.startGame(game, {
            masterSeed,
            startingPositions: { playerIds: order }
        }).initialState
        for (let step = 0; state.result === undefined; step++) {
            assert(step < 4000, 'The assigned game did not finish')
            const [playerId] = state.activePlayerIds
            assertExists(playerId, `No active player in ${state.machineState}`)
            const action = botAction(OstbahnRuntime.hydrator.hydrateState(state), playerId, step)
            state = engine.executeCanonicalAction({ game, state, action }).updatedState
        }
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(() => validateGameResult(state)).not.toThrow()
        const finalScores = OstbahnRuntime.scoring.finalScores(state)
        expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
        const best = Math.max(...Object.values(finalScores))
        expect(state.winningPlayerIds.length).toBeGreaterThan(0)
        expect(state.winningPlayerIds.every((playerId) => finalScores[playerId] === best)).toBe(
            true
        )
    })
})
