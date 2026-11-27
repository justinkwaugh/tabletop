import { describe, expect, it } from 'vitest'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import { ActionType } from '@tabletop/game-of-y'
import { historyEntries } from './historyEntries.js'

let counter = 0
function action(playerId: string, fields: { type: string } & Record<string, unknown>): GameAction {
    counter += 1
    return { id: `a${counter}`, gameId: 'g', source: ActionSource.User, playerId, ...fields }
}

describe('historyEntries', () => {
    it('reads placements and the swap from their metadata', () => {
        const entries = historyEntries([
            action('a', {
                type: ActionType.PlaceStone,
                point: 'E5',
                metadata: { stone: { id: 0, point: 'E5', color: Color.Black }, formsY: false }
            }),
            action('b', { type: ActionType.SwapColors })
        ])
        expect(entries).toMatchObject([
            { kind: 'place', playerId: 'a', point: 'E5', color: Color.Black, firstIndex: 0 },
            { kind: 'swap', playerId: 'b', firstIndex: 1 }
        ])
    })
})
