import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionType,
    CoralColor,
    type EatCoral,
    type TakeOpenSeaSpace
} from '@tabletop/reef-encounter'
import { turnSummary } from './turnRecap.js'

const take = (polyps: CoralColor[]): TakeOpenSeaSpace => ({
    id: 'take',
    gameId: 'game',
    source: ActionSource.User,
    type: ActionType.TakeOpenSeaSpace,
    playerId: 'a',
    larvaColor: CoralColor.Grey,
    metadata: { polyps }
})

const eat: EatCoral = {
    id: 'eat',
    gameId: 'game',
    source: ActionSource.User,
    type: ActionType.EatCoral,
    playerId: 'a',
    boardId: 3,
    coords: { row: 3, col: 1 },
    metadata: { color: CoralColor.Pink, polyps: 8, returnedToBag: 4, shrimpToOpenSea: false }
}

const summary = (polyps: CoralColor[]) =>
    turnSummary([take(polyps)], 'their', (boardId) => `Board ${boardId}`)

describe('the recap of a turn ended in the open sea', () => {
    it('shows each polyp taken, and says repeated colours once', () => {
        const recap = summary([CoralColor.White, CoralColor.Yellow, CoralColor.Yellow])
        expect(
            recap?.parts.filter(
                (part) => typeof part !== 'string' && 'icon' in part && part.icon === 'polyp'
            )
        ).toHaveLength(3)
        expect(recap?.text).toBe(
            'took the grey larva cube with a white polyp and two yellow polyps'
        )
    })

    it('lists polyps of different colours', () => {
        expect(summary([CoralColor.Grey, CoralColor.Orange])?.text).toBe(
            'took the grey larva cube with grey and orange polyps'
        )
    })

    it('says when the cube came alone', () => {
        expect(summary([])?.text).toBe('took the grey larva cube')
    })
})

describe('the recap of a turn that ate a coral', () => {
    // A recap of the feeding alone read as a leftover from the start of the turn.
    it('says how the turn ended after the feeding', () => {
        const recap = turnSummary(
            [eat, take([CoralColor.Grey, CoralColor.Grey, CoralColor.White])],
            'their',
            (boardId) => `Board ${boardId}`
        )
        expect(recap?.text).toBe(
            'fed 8 pink polyps to their parrotfish, then took the grey larva cube with two grey polyps and a white polyp'
        )
    })
})
