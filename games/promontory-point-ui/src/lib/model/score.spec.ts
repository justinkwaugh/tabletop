import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { MachineState, type RailroadId } from '@tabletop/promontory-point'
import { dealtTable, type Table } from '$lib/testing/sessionHarness.js'
import { seatOf, withHoldings } from '$lib/testing/tables.js'
import { scoreView } from './score.js'

const CP: RailroadId = 'railroad.cp'
const KP: RailroadId = 'railroad.kp'

function endedState(winningPlayerIds: (state: Table['state']) => string[]) {
    const dealt = dealtTable()
    const state = withHoldings(dealt.state, [
        { money: 10, shares: { [CP]: 2 } },
        { money: 30 },
        { money: 4, shares: { [CP]: 1, [KP]: 4 } }
    ])
    return {
        ...state,
        machineState: MachineState.EndOfGame,
        priceIndex: { ...state.priceIndex, [CP]: 14, [KP]: 9 },
        bag: { ...state.bag, remaining: 0 },
        winningPlayerIds: winningPlayerIds(state)
    }
}

describe('score (R-6.1, R-6.2, R-6.2-H1)', () => {
    it('R-6.2: a row per seat with money, count × final price, share value and total, winner first', () => {
        const state = endedState((dealt) => [seatOf(dealt, 2)])
        const score = scoreView(state)
        assertExists(score, 'The game has ended')
        expect(score.columns.map((column) => column.label)).toEqual([
            'CP $10',
            'UP $5',
            'KP $5',
            'SP $5'
        ])
        expect(
            score.rows.map((row) => [
                row.playerId,
                row.money,
                row.holdings.map((holding) => holding.text),
                row.shareValue,
                row.total,
                row.winner
            ])
        ).toEqual([
            [seatOf(state, 2), 4, ['1 × $10', '—', '4 × $5', '—'], 30, 34, true],
            [seatOf(state, 0), 10, ['2 × $10', '—', '—', '—'], 20, 30, false],
            [seatOf(state, 1), 30, ['—', '—', '—', '—'], 0, 30, false]
        ])
        expect(score.winnerIds).toEqual([seatOf(state, 2)])
        expect(score.winningTotal).toBe(34)
    })

    it('R-6.1: the end reason stands above the score', () => {
        expect(scoreView(endedState((dealt) => [seatOf(dealt, 2)]))?.reason).toBe(
            'The bag is empty'
        )
    })

    it('R-6.2-H1: every tied winner is named and marked', () => {
        const state = endedState((dealt) => [seatOf(dealt, 0), seatOf(dealt, 1)])
        const score = scoreView(state)
        expect(score?.winnerIds).toEqual([seatOf(state, 0), seatOf(state, 1)])
        expect(score?.rows.filter((row) => row.winner)).toHaveLength(2)
    })

    it('no score before the game ends', () => {
        expect(scoreView(dealtTable().state)).toBeUndefined()
    })
})
