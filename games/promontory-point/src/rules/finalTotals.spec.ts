import { describe, expect, it } from 'vitest'
import { START_PRICE_INDEX } from '../components/priceTrack.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { canonical, startGame } from '../testing/startGame.js'
import { finalTotals, winningPlayerIds } from './finalTotals.js'

function atGameEnd(change: (state: PromontoryPointGameState) => void): PromontoryPointGameState {
    const state = structuredClone(startGame({ playerCount: 3 }).state)
    change(state)
    return canonical(state)
}

function setHoldings(
    state: PromontoryPointGameState,
    holdings: { money: number; cp: number; up: number; kp: number; sp: number }[]
) {
    state.players.forEach((player, index) => {
        const { money, cp, up, kp, sp } = holdings[index]
        player.money = money
        player.shares = {
            'railroad.cp': cp,
            'railroad.up': up,
            'railroad.kp': kp,
            'railroad.sp': sp
        }
    })
}

describe('Promontory Point final totals', () => {
    it('R-6.2: a final total is money plus each share at its railroad final price', () => {
        const state = atGameEnd((state) => {
            state.priceIndex = {
                'railroad.cp': 29,
                'railroad.up': START_PRICE_INDEX,
                'railroad.kp': 2,
                'railroad.sp': 5
            }
            setHoldings(state, [
                { money: 10, cp: 2, up: 1, kp: 3, sp: 0 },
                { money: 0, cp: 0, up: 4, kp: 0, sp: 2 },
                { money: 7, cp: 0, up: 0, kp: 0, sp: 0 }
            ])
        })
        const [first, second, third] = finalTotals(state)

        expect(first).toEqual({
            playerId: state.players[0].playerId,
            money: 10,
            holdings: {
                'railroad.cp': { shares: 2, price: 25, value: 50 },
                'railroad.up': { shares: 1, price: 5, value: 5 },
                'railroad.kp': { shares: 3, price: 0, value: 0 },
                'railroad.sp': { shares: 0, price: 1, value: 0 }
            },
            shareValue: 55,
            total: 65
        })
        expect(second.shareValue).toBe(22)
        expect(second.total).toBe(22)
        expect(third.total).toBe(7)
        expect(state.players.map((player) => player.money)).toEqual([10, 0, 7])
        expect(winningPlayerIds(finalTotals(state))).toEqual([state.players[0].playerId])
    })

    it('R-6.2-H1: every tied leader wins, with no tie-break on money or shares', () => {
        const state = atGameEnd((state) => {
            state.priceIndex = {
                'railroad.cp': START_PRICE_INDEX,
                'railroad.up': START_PRICE_INDEX,
                'railroad.kp': START_PRICE_INDEX,
                'railroad.sp': START_PRICE_INDEX
            }
            setHoldings(state, [
                { money: 20, cp: 0, up: 0, kp: 0, sp: 0 },
                { money: 5, cp: 1, up: 1, kp: 1, sp: 0 },
                { money: 0, cp: 0, up: 0, kp: 0, sp: 4 }
            ])
        })

        expect(finalTotals(state).map((total) => total.total)).toEqual([20, 20, 20])
        expect(winningPlayerIds(finalTotals(state))).toEqual(
            state.players.map((player) => player.playerId)
        )
    })

    it('R-6.2-H1: a tie below the leader names no winner beyond the leader', () => {
        const state = atGameEnd((state) => {
            setHoldings(state, [
                { money: 3, cp: 0, up: 0, kp: 0, sp: 0 },
                { money: 9, cp: 0, up: 0, kp: 0, sp: 0 },
                { money: 3, cp: 0, up: 0, kp: 0, sp: 0 }
            ])
        })

        expect(winningPlayerIds(finalTotals(state))).toEqual([state.players[1].playerId])
    })
})
