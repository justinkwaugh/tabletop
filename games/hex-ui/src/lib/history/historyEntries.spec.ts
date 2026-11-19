import { describe, expect, it } from 'vitest'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import { ActionType } from '@tabletop/hex'
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
                cell: 'F6',
                metadata: { stone: { id: 0, cell: 'F6', color: Color.Red }, joinsEdges: false }
            }),
            action('b', { type: ActionType.SwapColors })
        ])
        expect(entries).toMatchObject([
            { kind: 'place', playerId: 'a', cell: 'F6', color: Color.Red, firstIndex: 0 },
            { kind: 'swap', playerId: 'b', firstIndex: 1 }
        ])
    })
})
