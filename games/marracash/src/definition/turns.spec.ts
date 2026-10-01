import { CardinalDirection, MachineContext, validateGameResult } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { routesFrom } from '../components/board.js'
import { QueueEnd } from '../components/visitors.js'
import { MarketColor } from './marketColor.js'
import { MachineState } from './states.js'
import type { MarracashProjectedState } from '../model/gameState.js'
import { startTestGame, type TestSession } from '../util/testHelper.js'
import { MarracashRuntime } from './runtime.js'

const { Red, Blue, Green, Yellow } = MarketColor

function fountain(state: MarracashProjectedState, fountainId: number) {
    const found = state.fountains.find((candidate) => candidate.fountainId === fountainId)
    if (!found) throw Error(`No fountain ${fountainId}`)
    return found
}

function moveTwice(session: TestSession) {
    const playerId = session.currentPlayerId()
    session.move(playerId, 9, CardinalDirection.East)
    session.move(playerId, 10, CardinalDirection.East)
}

function roundTwoWithEmptyEntrance(queue: MarketColor[] = [Red, Blue, Green, Yellow, Red]) {
    const session = startTestGame(3)
    session.edit((state) => {
        state.round = 2
        for (const candidate of state.fountains) candidate.visitors = []
        fountain(state, 9).visitors = [Red]
        fountain(state, 1).visitors = [Blue]
        fountain(state, 8).visitors = [Green]
        state.queue = queue
    })
    return session
}

describe('MarraCash refilling entrances', () => {
    it('asks the player to refill an empty entrance at the end of their turn', () => {
        const session = roundTwoWithEmptyEntrance()
        const playerId = session.currentPlayerId()
        moveTwice(session)
        expect(session.state.machineState).toBe(MachineState.RefillingEntrances)
        expect(session.state.activePlayerIds).toEqual([playerId])

        session.bringVisitors(playerId, QueueEnd.Back, 3, 16)
        expect(fountain(session.state, 16).visitors).toEqual([Green, Yellow, Red])
        expect(session.state.queue).toEqual([Red, Blue])
        expect(session.state.machineState).toBe(MachineState.ChoosingAction)
        expect(session.currentPlayerId()).not.toBe(playerId)
    })

    it('takes 2 to 4 visitors from one end into an empty entrance only', () => {
        const session = roundTwoWithEmptyEntrance()
        const playerId = session.currentPlayerId()
        moveTwice(session)
        expect(() => session.bringVisitors(playerId, QueueEnd.Front, 1, 16)).toThrow()
        expect(() => session.bringVisitors(playerId, QueueEnd.Front, 5, 16)).toThrow()
        expect(() => session.bringVisitors(playerId, QueueEnd.Front, 2, 1)).toThrow()
        session.bringVisitors(playerId, QueueEnd.Front, 2, 16)
        expect(fountain(session.state, 16).visitors).toEqual([Red, Blue])
    })

    it('refills every empty entrance', () => {
        const session = roundTwoWithEmptyEntrance([Red, Blue, Green, Yellow, Red, Blue])
        session.edit((state) => {
            fountain(state, 8).visitors = []
            fountain(state, 14).visitors = [Green]
        })
        const playerId = session.currentPlayerId()
        session.move(playerId, 9, CardinalDirection.East)
        session.move(playerId, 14, CardinalDirection.East)
        session.bringVisitors(playerId, QueueEnd.Front, 2, 8)
        expect(session.state.machineState).toBe(MachineState.RefillingEntrances)
        session.bringVisitors(playerId, QueueEnd.Front, 2, 16)
        expect(session.state.machineState).toBe(MachineState.ChoosingAction)
    })

    it('places a single last visitor on its own', () => {
        const session = roundTwoWithEmptyEntrance([Yellow])
        const playerId = session.currentPlayerId()
        moveTwice(session)
        expect(() => session.bringVisitors(playerId, QueueEnd.Front, 2, 16)).toThrow()
        session.bringVisitors(playerId, QueueEnd.Front, 1, 16)
        expect(session.state.queue).toEqual([])
        expect(session.state.finalRound).toBe(true)
    })
})

describe('MarraCash end of game', () => {
    it('plays out the round after the queue empties, then ends', () => {
        const session = roundTwoWithEmptyEntrance([Yellow, Yellow])
        const order = session.state.turnManager.turnOrder
        moveTwice(session)
        session.bringVisitors(order[0], QueueEnd.Front, 2, 16)
        expect(session.state.finalRound).toBe(true)

        for (const playerId of order.slice(1)) {
            expect(session.state.machineState).toBe(MachineState.ChoosingAction)
            expect(session.currentPlayerId()).toBe(playerId)
            const start = session.state.fountains.find((f) => f.visitors.length > 0)
            if (!start) throw Error('No visitors left to move')
            const [route] = routesFrom(start.fountainId)
            session.move(playerId, start.fountainId, route.direction)
            const next = session.state.fountains.find((f) => f.visitors.length > 0)
            if (!next) throw Error('No visitors left to move')
            const [nextRoute] = routesFrom(next.fountainId)
            session.move(playerId, next.fountainId, nextRoute.direction)
        }

        expect(session.state.machineState).toBe(MachineState.EndOfGame)
        expect(session.state.activePlayerIds).toEqual([])
    })

    it('ends straight away when the last seat empties the queue', () => {
        const session = roundTwoWithEmptyEntrance([Yellow, Yellow])
        const order = session.state.turnManager.turnOrder
        session.edit((state) => {
            state.turnManager.turnOrder = [order[1], order[2], order[0]]
        })
        moveTwice(session)
        session.bringVisitors(order[0], QueueEnd.Front, 2, 16)
        expect(session.state.machineState).toBe(MachineState.EndOfGame)
    })

    it('leaves entrances empty once the queue has run out', () => {
        const session = roundTwoWithEmptyEntrance([])
        session.edit((state) => {
            state.finalRound = true
        })
        const playerId = session.currentPlayerId()
        moveTwice(session)
        expect(session.state.machineState).not.toBe(MachineState.RefillingEntrances)
        expect(session.currentPlayerId()).not.toBe(playerId)
    })

    it('skips a player who cannot do anything', () => {
        const session = startTestGame(3)
        const [first, second, third] = session.state.turnManager.turnOrder
        session.edit((state) => {
            state.round = 2
            for (const candidate of state.fountains) candidate.visitors = []
            fountain(state, 9).visitors = [Red]
            fountain(state, 10).visitors = [Yellow]
            state.queue = []
            for (const shop of state.shops) {
                if (shop.shopId === 'R3' || shop.shopId === 'Y3') shop.ownerId = first
            }
            const poor = state.players.find((player) => player.playerId === second)
            if (poor) poor.money = 50
        })
        session.move(first, 9, CardinalDirection.East)
        session.move(first, 10, CardinalDirection.East)
        expect(session.state.fountains.every((f) => f.visitors.length === 0)).toBe(true)
        expect(session.currentPlayerId()).toBe(third)
    })

    it('declares the richest player the winner and shares ties', () => {
        const session = startTestGame(3)
        const [a, b, c] = session.state.turnManager.turnOrder
        const finish = (money: Record<string, number>) => {
            const state = MarracashRuntime.hydrator.hydrateState(structuredClone(session.state))
            for (const player of state.players) player.money = money[player.playerId]
            const handler = MarracashRuntime.stateHandlers[MachineState.EndOfGame]
            handler.enter(new MachineContext({ gameConfig: session.game.config, gameState: state }))
            return state
        }
        const single = finish({ [a]: 900, [b]: 1200, [c]: 300 })
        expect(single.winningPlayerIds).toEqual([b])
        expect(() => validateGameResult(single.dehydrate())).not.toThrow()

        const tie = finish({ [a]: 1200, [b]: 1200, [c]: 300 })
        expect(tie.winningPlayerIds.toSorted()).toEqual([a, b].toSorted())
        expect(MarracashRuntime.scoring.finalScores(tie.dehydrate())).toEqual({
            [a]: 1200,
            [b]: 1200,
            [c]: 300
        })
    })
})
