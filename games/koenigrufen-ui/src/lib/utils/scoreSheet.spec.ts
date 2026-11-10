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

describe('score sheet', () => {
    it('lists each finished hand in order and totals every player', () => {
        const actions = [
            endHand('a', { p1: 1, p2: 1, p3: -1, p4: -1 }, 'p2'),
            { id: 'b', gameId: 'g', source: ActionSource.User, type: ActionType.Pass },
            endHand('c', { p1: -3, p2: 1, p3: 1, p4: 1 })
        ]
        const sheet = scoreSheet(actions, ['p1', 'p2', 'p3', 'p4'])
        expect(sheet.hands.map((hand) => hand.scoreChanges.p1)).toEqual([1, -3])
        expect(sheet.totals).toEqual({ p1: -2, p2: 2, p3: 0, p4: 0 })
    })

    it('names the declaring side and the points left to the defenders', () => {
        const [withPartner, alone] = scoreSheet(
            [endHand('a', {}, 'p3'), endHand('b', {})],
            []
        ).hands
        expect(declarerSide(withPartner!)).toEqual(['p1', 'p3'])
        expect(declarerSide(alone!)).toEqual(['p1'])
        expect(defenderPoints(alone!)).toBe(30)
    })
})
