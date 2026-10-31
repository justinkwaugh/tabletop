import { assertExists, type Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { perRailroad, type RailroadId } from '../components/railroads.js'
import { MachineState } from '../definition/states.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import type { Debtor } from '../model/pendingRepairs.js'
import { SaleListRefusal } from '../rules/repairs.js'
import { engine, startGame } from '../testing/startGame.js'
import {
    action,
    edited,
    playerOf,
    refusedIn,
    revealedTurn,
    shareDeckCount
} from '../testing/turns.js'
import { PayRepairs, PayRepairsRefusal, isPayRepairs } from './payRepairs.js'

const CP = 'railroad.cp'
const UP = 'railroad.up'
const KP = 'railroad.kp'
// R-1.2: index 4 is the last 0; index i from 5 is price i − 4.
const PRICE_0 = 4
const PRICE_2 = 6
const PRICE_5 = 9
const PRICE_8 = 12

type Holding = { money: number; shares?: Partial<Record<RailroadId, number>> }

function seat(state: PromontoryPointGameState, index: number): string {
    const playerId = state.turnManager.turnOrder[index]
    assertExists(playerId, `No seat ${index}`)
    return playerId
}

// A Repairs on the Central Pacific waiting on debtors given by seat, the first of them active.
function repairsPending(
    holdings: Holding[],
    debtors: { seat: number; owed: number }[]
): { game: Game; state: PromontoryPointGameState } {
    const { game, state } = startGame()
    const trading = revealedTurn(game, state)
    return {
        game,
        state: edited(trading, (draft) => {
            for (const [index, { money, shares = {} }] of holdings.entries()) {
                const player = playerOf(draft, seat(draft, index))
                player.money = money
                player.shares = perRailroad((railroadId) => shares[railroadId] ?? 0)
            }
            draft.priceIndex = { ...draft.priceIndex, [CP]: PRICE_5, [UP]: PRICE_8, [KP]: PRICE_0 }
            const queue: Debtor[] = debtors.map(({ seat: index, owed }) => ({
                playerId: seat(draft, index),
                owed
            }))
            draft.machineState = MachineState.PayingRepairs
            draft.pendingRepairs = { railroadId: CP, debtors: queue }
            draft.activePlayerIds = [queue[0].playerId]
        })
    }
}

function pay(
    game: Game,
    state: PromontoryPointGameState,
    sales: RailroadId[],
    playerId = state.pendingRepairs?.debtors[0].playerId
) {
    const { processedActions, updatedState } = engine.executeCanonicalAction({
        action: action(PayRepairs, state, { playerId, sales }),
        state,
        game
    })
    const payment = processedActions[0]
    if (!isPayRepairs(payment)) {
        throw new Error(`Expected a PayRepairs, got ${payment?.type}`)
    }
    return { processedActions, payment, updatedState }
}

describe('PayRepairs', () => {
    describe('R-4.3: the first debtor pays', () => {
        it('R-4.3, R-4.3-H2, R-3.2: sells in order until able to pay, pays in full, and the next debtor decides; no price moves', () => {
            const { game, state } = repairsPending(
                [
                    { money: 9 },
                    { money: 1, shares: { [CP]: 2, [UP]: 2 } },
                    { money: 0, shares: { [CP]: 1 } }
                ],
                [
                    { seat: 1, owed: 4 },
                    { seat: 2, owed: 2 }
                ]
            )
            const debtorId = seat(state, 1)

            const { processedActions, payment, updatedState } = pay(game, state, [UP])

            const debtor = playerOf(updatedState, debtorId)
            expect(debtor.money).toBe(1)
            expect(debtor.shares[CP]).toBe(2)
            expect(debtor.shares[UP]).toBe(1)
            expect(shareDeckCount(updatedState, UP)).toBe(shareDeckCount(state, UP) + 1)
            expect(updatedState.priceIndex).toEqual(state.priceIndex)
            expect(updatedState.turn).toEqual(state.turn)
            expect(updatedState.pendingRepairs).toEqual({
                railroadId: CP,
                debtors: [{ playerId: seat(state, 2), owed: 2 }]
            })
            expect(playerOf(updatedState, seat(state, 0))).toEqual(playerOf(state, seat(state, 0)))
            expect(playerOf(updatedState, seat(state, 2))).toEqual(playerOf(state, seat(state, 2)))
            expect(processedActions).toHaveLength(1)
            expect(payment.metadata).toEqual({
                sales: [{ railroadId: UP, proceeds: 4 }],
                paid: 4,
                forgiven: 0
            })
        })

        it('R-4.3-H4: the turn player pays as the first debtor too, and the last payment ends the Repairs', () => {
            const { game, state } = repairsPending(
                [{ money: 3, shares: { [CP]: 2, [UP]: 1 } }],
                [{ seat: 0, owed: 4 }]
            )
            const turnPlayerId = seat(state, 0)

            const { payment, updatedState } = pay(game, state, [CP])

            expect(playerOf(updatedState, turnPlayerId).money).toBe(1)
            expect(playerOf(updatedState, turnPlayerId).shares[CP]).toBe(1)
            expect(updatedState.pendingRepairs).toBeUndefined()
            expect(updatedState.turn?.tradesUsed).toBe(state.turn?.tradesUsed)
            expect(payment.metadata).toEqual({
                sales: [{ railroadId: CP, proceeds: 2 }],
                paid: 4,
                forgiven: 0
            })
        })

        it('R-4.3-H1: selling shares of the billed railroad does not lower the bill', () => {
            const { game, state } = repairsPending(
                [{ money: 9 }, { money: 0, shares: { [CP]: 2, [KP]: 1 } }],
                [{ seat: 1, owed: 4 }]
            )
            const debtorId = seat(state, 1)

            expect(() => pay(game, state, [CP])).toThrow(SaleListRefusal.StoppedWhileShort)
            const { payment, updatedState } = pay(game, state, [CP, CP])

            // The recount reading would bill nothing once both are sold and leave the $4 raised.
            expect(playerOf(updatedState, debtorId).money).toBe(0)
            expect(payment.metadata).toEqual({
                sales: [
                    { railroadId: CP, proceeds: 2 },
                    { railroadId: CP, proceeds: 2 }
                ],
                paid: 4,
                forgiven: 0
            })
        })

        it('R-4.3-H3: a seat short after selling every share pays all it has, the rest is forgiven, and it stays in the game with $0', () => {
            const pending = repairsPending(
                [{ money: 9 }, { money: 1, shares: { [CP]: 3, [KP]: 1 } }],
                [{ seat: 1, owed: 6 }]
            )
            const state = edited(pending.state, (draft) => {
                draft.priceIndex[CP] = PRICE_2
            })
            const debtorId = seat(state, 1)

            expect(() => pay(pending.game, state, [CP, CP, CP])).toThrow(
                SaleListRefusal.StoppedWhileShort
            )
            const { payment, updatedState } = pay(pending.game, state, [KP, CP, CP, CP])

            const debtor = playerOf(updatedState, debtorId)
            expect(debtor.money).toBe(0)
            expect(debtor.shares).toEqual(perRailroad(() => 0))
            expect(updatedState.turnManager.turnOrder).toEqual(state.turnManager.turnOrder)
            expect(updatedState.players.map((player) => player.playerId)).toEqual(
                state.players.map((player) => player.playerId)
            )
            expect(updatedState.pendingRepairs).toBeUndefined()
            expect(payment.metadata).toEqual({
                sales: [
                    { railroadId: KP, proceeds: 0 },
                    { railroadId: CP, proceeds: 1 },
                    { railroadId: CP, proceeds: 1 },
                    { railroadId: CP, proceeds: 1 }
                ],
                paid: 4,
                forgiven: 2
            })
        })

        it('R-4.3-H3: a seat with no shares sends the empty list and pays what it has', () => {
            const { game, state } = repairsPending(
                [{ money: 9 }, { money: 1 }],
                [{ seat: 1, owed: 2 }]
            )

            const { payment, updatedState } = pay(game, state, [])

            expect(playerOf(updatedState, seat(state, 1)).money).toBe(0)
            expect(payment.metadata).toEqual({ sales: [], paid: 1, forgiven: 1 })
        })
    })

    describe('R-4.3: refusals', () => {
        const shortSeat = () =>
            repairsPending(
                [
                    { money: 9 },
                    { money: 1, shares: { [CP]: 2, [UP]: 1 } },
                    { money: 0, shares: { [CP]: 1 } }
                ],
                [
                    { seat: 1, owed: 4 },
                    { seat: 2, owed: 2 }
                ]
            )

        it('R-4.3: is refused for a share not held', () => {
            const { game, state } = shortSeat()

            expect(() => pay(game, state, [KP])).toThrow(SaleListRefusal.NotHeld)
            expect(() => pay(game, state, [UP, UP])).toThrow(SaleListRefusal.NotHeld)
        })

        it('R-4.3-H2: is refused for selling on once able to pay', () => {
            const { game, state } = shortSeat()

            expect(() => pay(game, state, [UP, CP])).toThrow(SaleListRefusal.SoldAfterAbleToPay)
        })

        it('R-4.3-H2: is refused for stopping short while shares remain', () => {
            const { game, state } = shortSeat()

            expect(() => pay(game, state, [CP])).toThrow(SaleListRefusal.StoppedWhileShort)
            expect(() => pay(game, state, [])).toThrow(SaleListRefusal.StoppedWhileShort)
        })

        it('R-4.3-H4: is refused for a debtor not first in the queue, and for the turn player who is not one', () => {
            const { game, state } = shortSeat()
            const everyoneActive = edited(state, (draft) => {
                draft.activePlayerIds = draft.turnManager.turnOrder
            })

            expect(() => pay(game, everyoneActive, [], seat(state, 2))).toThrow(
                PayRepairsRefusal.NotFirstDebtor
            )
            expect(() => pay(game, everyoneActive, [], seat(state, 0))).toThrow(
                PayRepairsRefusal.NotFirstDebtor
            )
        })

        it('R-4.3: is refused when no Repairs waits', () => {
            const { game, state } = startGame()
            const trading = revealedTurn(game, state)

            expect(() => pay(game, trading, [], seat(trading, 0))).toThrow(
                refusedIn(MachineState.TradingBeforePlacing)
            )
        })
    })

    describe('R-X.2: not a barrier', () => {
        it('R-X.2: undo restores the queue and the debtor’s shares and money', () => {
            const { game, state } = repairsPending(
                [
                    { money: 9 },
                    { money: 1, shares: { [CP]: 3, [UP]: 1 } },
                    { money: 0, shares: { [CP]: 1 } }
                ],
                [
                    { seat: 1, owed: 6 },
                    { seat: 2, owed: 2 }
                ]
            )

            const { payment, updatedState } = pay(game, state, [UP, CP])
            expect(updatedState.pendingRepairs?.debtors).toHaveLength(1)
            expect(payment.revealsInfo).toBeFalsy()

            expect(engine.undoProcessedAction({ state: updatedState, action: payment })).toEqual(
                state
            )
        })
    })
})
