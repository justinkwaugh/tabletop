import { ActionSource, type GameAction, type Turn } from '@tabletop/common'
import { ActionType, DiscardAnyTime } from '@tabletop/feudum'
import { describe, expect, it } from 'vitest'
import { isDecisionPress, isOffTurnDiscard, turnSeatAt } from './decisionPress.js'

const Base = { id: 'a', gameId: 'g', source: ActionSource.User }

function discard(playerId: string, index: number): GameAction {
    return {
        ...Base,
        type: ActionType.DiscardWrit,
        playerId,
        index,
        writId: 'writ.mandate.5',
        ...DiscardAnyTime
    } as GameAction
}

/** Dana's turn ended at the AdvanceTurn at 7, which began Rhys's. */
const Turns: Turn[] = [
    { type: 'turn', playerId: 'dana', start: 3, end: 8 },
    { type: 'turn', playerId: 'rhys', start: 7 }
]

describe('R-4.4-H5 a press that moves a decision on', () => {
    it('R-3.2 the turn an Action was played in is read from the series, not from the latest turn', () => {
        expect(turnSeatAt(Turns, discard('dana', 6))).toBe('dana')
        expect(turnSeatAt(Turns, discard('dana', 9))).toBe('rhys')
        expect(turnSeatAt(Turns, discard('dana', 2))).toBeUndefined()
    })

    it("R-4.4-H5 another seat's discard is off the turn; the turn player's own is a press", () => {
        expect(isOffTurnDiscard(discard('ann', 6), 'dana')).toBe(true)
        expect(isDecisionPress(discard('ann', 6), 'dana')).toBe(false)
        expect(isOffTurnDiscard(discard('dana', 6), 'dana')).toBe(false)
        expect(isDecisionPress(discard('dana', 6), 'dana')).toBe(true)
    })

    it('R-4.4-H5 outside a turn no discard is a press', () => {
        expect(isDecisionPress(discard('dana', 2), undefined)).toBe(false)
    })

    it('Any other press of a seat is one; a System Action is not', () => {
        const card = { ...Base, type: ActionType.ForfeitCard, playerId: 'ann', index: 6 }
        expect(isDecisionPress(card as GameAction, 'dana')).toBe(true)
        expect(
            isDecisionPress({ ...card, source: ActionSource.System } as GameAction, 'dana')
        ).toBe(false)
    })
})
