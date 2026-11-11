import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { viewedHistoryPosition } from './viewedHistoryPosition.js'

function history(...moves: [playerId: string | undefined, source?: ActionSource][]): GameAction[] {
    return moves.map(([playerId, source = ActionSource.User], index) => ({
        id: `a${index}`,
        gameId: 'g',
        type: 'move',
        source,
        playerId,
        index
    }))
}

describe('viewedHistoryPosition', () => {
    const liveActions = history(['a'], [undefined, ActionSource.System], ['b'], ['a'])
    const at = (actionIndex: number, playerId: string) =>
        viewedHistoryPosition({ actionIndex, liveActionCount: 4, liveActions, playerId })

    it('reports how many actions the live game has', () => {
        expect(at(2, 'a').liveActionCount).toBe(4)
    })

    it('is within reach where the player’s own Undo gets to', () => {
        expect(at(3, 'a').beyondUndoReach).toBe(false)
    })

    it('is beyond reach past the player’s own Undo', () => {
        expect(at(2, 'a').beyondUndoReach).toBe(true)
        expect(at(3, 'b').beyondUndoReach).toBe(true)
    })

    it('says whether the position starts with a user action', () => {
        expect(at(2, 'a').startsWithUserAction).toBe(true)
        expect(at(1, 'a').startsWithUserAction).toBe(false)
    })
})
