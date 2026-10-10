import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, CoralColor } from '@tabletop/reef-encounter'
import { capitalised, describeActions } from './actionDescription.js'

let next = 0
const base = (type: ActionType, playerId?: string) => ({
    id: `action-${next++}`,
    gameId: 'game',
    type,
    playerId,
    source: playerId ? ActionSource.User : ActionSource.System
})

const placed = (color: CoralColor, boardId: number, attacked?: CoralColor): GameAction => ({
    ...base(ActionType.PlacePolyp, 'a'),
    boardId,
    coords: { row: 0, col: 0 },
    fromConsumed: false,
    metadata: { color, attacked }
})

describe('describing a turn', () => {
    it('merges plain placements of one colour on one board', () => {
        const phrases = describeActions(
            [
                { ...base(ActionType.PlayLarvaCube, 'a'), color: CoralColor.Orange },
                placed(CoralColor.Orange, 1),
                placed(CoralColor.Orange, 1),
                placed(CoralColor.Orange, 2)
            ],
            'their'
        )
        expect(phrases).toEqual([
            'played an orange larva cube.',
            'placed 2 orange polyps on board 1.',
            'placed an orange polyp on board 2.'
        ])
    })

    it('keeps an attack on its own line', () => {
        const phrases = describeActions(
            [placed(CoralColor.White, 1), placed(CoralColor.White, 1, CoralColor.Yellow)],
            'their'
        )
        expect(phrases).toEqual([
            'placed a white polyp on board 1.',
            'placed a white polyp on board 1, consuming a yellow polyp.'
        ])
    })

    it('speaks to the viewer about their own parrotfish', () => {
        const feed = { ...base(ActionType.FeedParrotfish, 'a'), color: CoralColor.Grey }
        expect(describeActions([feed], 'your')).toEqual(['fed a grey polyp to your parrotfish.'])
        expect(capitalised('fed a grey polyp.')).toBe('Fed a grey polyp.')
    })
})
