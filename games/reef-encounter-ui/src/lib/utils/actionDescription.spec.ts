import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionType,
    CoralColor,
    type FeedParrotfish,
    type PlayLarvaCube,
    type PlacePolyp
} from '@tabletop/reef-encounter'
import { capitalised, describeActions } from './actionDescription.js'

let next = 0
const base = () => ({ id: `action-${next++}`, gameId: 'game', source: ActionSource.User })

const placed = (color: CoralColor, boardId: 1 | 2, attacked?: CoralColor): PlacePolyp => ({
    ...base(),
    type: ActionType.PlacePolyp,
    playerId: 'a',
    boardId,
    coords: { row: 0, col: 0 },
    fromConsumed: false,
    metadata: { color, attacked }
})

const played = (color: CoralColor): PlayLarvaCube => ({
    ...base(),
    type: ActionType.PlayLarvaCube,
    playerId: 'a',
    color
})

const texts = (...args: Parameters<typeof describeActions>) =>
    describeActions(...args).map((phrase) => phrase.text)

describe('describing a turn', () => {
    it('merges plain placements of one colour on one board', () => {
        const phrases = texts(
            [
                played(CoralColor.Orange),
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
        const phrases = texts(
            [placed(CoralColor.White, 1), placed(CoralColor.White, 1, CoralColor.Yellow)],
            'their'
        )
        expect(phrases).toEqual([
            'placed a white polyp on board 1.',
            'placed a white polyp on board 1, consuming a yellow polyp.'
        ])
    })

    it('speaks to the viewer about their own parrotfish', () => {
        const feed: FeedParrotfish = {
            ...base(),
            type: ActionType.FeedParrotfish,
            playerId: 'a',
            color: CoralColor.Grey
        }
        expect(describeActions([feed], 'your')).toEqual([
            { text: 'fed a grey polyp to your parrotfish.', playerId: 'a' }
        ])
        expect(capitalised('fed a grey polyp.')).toBe('Fed a grey polyp.')
    })
})
