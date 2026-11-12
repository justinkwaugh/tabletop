import { ActionSource } from '@tabletop/common'
import { ActionType, Contract } from '@tabletop/koenigrufen'
import { describe, expect, it } from 'vitest'
import { declarerSide, defenderPoints, scoreSheet } from './scoreSheet.js'

function endHand(id: string, scoreChanges: Record<string, number>, partnerId?: string) {
    return {
        id,
        gameId: 'g',
        source: ActionSource.System,
        type: ActionType.EndHand,
        metadata: {
            contract: Contract.Rufer,
            declarerId: 'p1',
            partnerId,
            declarerPoints: 40,
            made: true,
            scoreChanges,
            talon: [],
            discards: []
        }
    }
}

const players = (scores: Record<string, number>) =>
    Object.entries(scores).map(([playerId, score]) => ({ playerId, score }))

describe('score sheet', () => {
    it('lists each finished hand in order, numbered, and totals every player from State', () => {
        const actions = [
            endHand('a', { p1: 1, p2: 1, p3: -1, p4: -1 }, 'p2'),
            { id: 'b', gameId: 'g', source: ActionSource.User, type: ActionType.Pass },
            endHand('c', { p1: -3, p2: 1, p3: 1, p4: 1 })
        ]
        const sheet = scoreSheet(actions, players({ p1: -2, p2: 2, p3: 0, p4: 0 }), 2)
        expect(sheet.rows.map((row) => [row.hand, row.result.scoreChanges.p1])).toEqual([
            [1, 1],
            [2, -3]
        ])
        expect(sheet.complete).toBe(true)
        expect(sheet.totals).toEqual({ p1: -2, p2: 2, p3: 0, p4: 0 })
    })

    it('numbers the hands history holds by the hands finished, and keeps State totals', () => {
        // History has loaded only the latest hand of three.
        const actions = [endHand('c', { p1: -3, p2: 1, p3: 1, p4: 1 })]
        const sheet = scoreSheet(actions, players({ p1: 5, p2: -1, p3: -2, p4: -2 }), 3)
        expect(sheet.rows.map((row) => row.hand)).toEqual([3])
        expect(sheet.complete).toBe(false)
        expect(sheet.totals).toEqual({ p1: 5, p2: -1, p3: -2, p4: -2 })
    })

    it('names the declaring side and the points left to the defenders', () => {
        const [withPartner, alone] = scoreSheet(
            [endHand('a', {}, 'p3'), endHand('b', {})],
            [],
            2
        ).rows.map((row) => row.result)
        expect(declarerSide(withPartner!)).toEqual(['p1', 'p3'])
        expect(declarerSide(alone!)).toEqual(['p1'])
        expect(defenderPoints(alone!)).toBe(30)
    })
})
