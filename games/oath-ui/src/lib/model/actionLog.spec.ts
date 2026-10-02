import { describe, expect, it } from 'vitest'
import { ActionType } from '@tabletop/oath'
import { ActionSource, type GameAction } from '@tabletop/common'
import { lastEndDieRoll } from './actionLog.js'

function action(fields: { type: ActionType; playerId?: string } & Record<string, unknown>): GameAction {
    return { id: `a-${fields.type}`, gameId: 'g1', source: ActionSource.User, ...fields }
}

describe('R-3.3 — the last face the end die showed', () => {
    it('is none before any roll', () => {
        expect(lastEndDieRoll([action({ type: ActionType.CompleteRest, playerId: 'p2', metadata: {} })])).toBeUndefined()
    })

    it('reads the Chancellor’s roll at the end of a round', () => {
        const roll = action({ type: ActionType.RollEndDie, playerId: 'p1', metadata: { roll: 4, round: 6, threshold: 5 } })
        expect(lastEndDieRoll([roll])).toBe(4)
    })

    it('reads the roll a Rest recorded in a game created before the turn-flow revision (R-X.4)', () => {
        const rest = action({ type: ActionType.CompleteRest, playerId: 'p2', metadata: { endDieRoll: 2, round: 6 } })
        expect(lastEndDieRoll([rest])).toBe(2)
    })

    it('takes the latest of several', () => {
        const fifth = action({ type: ActionType.RollEndDie, playerId: 'p1', metadata: { roll: 1, round: 5, threshold: 6 } })
        const sixth = action({ type: ActionType.RollEndDie, playerId: 'p1', metadata: { roll: 3, round: 6, threshold: 5 } })
        expect(lastEndDieRoll([fifth, action({ type: ActionType.EndActPhase, playerId: 'p2' }), sixth])).toBe(3)
    })
})
