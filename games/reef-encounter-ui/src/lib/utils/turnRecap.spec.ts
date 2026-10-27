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

const actionOf = (type: ActionType, id: string) => ({
    id,
    gameId: 'game',
    source: ActionSource.User,
    type,
    playerId: 'a'
})

const recapOf = (actions: Parameters<typeof turnSummary>[0]) =>
    turnSummary(actions, 'their', (boardId) => `Board ${boardId}`)?.text

describe('the recap of a whole turn', () => {
    const middle = [
        actionOf(ActionType.PlayLarvaCube, 'play'),
        actionOf(ActionType.PlacePolyp, 'place-1'),
        actionOf(ActionType.PlacePolyp, 'place-2'),
        {
            ...actionOf(ActionType.MoveShrimp, 'move'),
            from: { boardId: 3, coords: { row: 2, col: 2 } }
        },
        actionOf(ActionType.ExchangeLarvaCube, 'exchange')
    ]

    it('tells the feeding, the actions taken and how the turn ended', () => {
        expect(recapOf([eat, ...middle, take([CoralColor.Grey, CoralColor.White])])).toBe(
            'fed 8 pink polyps to their parrotfish, took 3 actions, and took the grey larva cube with grey and white polyps'
        )
    })

    it('leaves out the parts the turn did not have', () => {
        expect(recapOf([...middle, take([])])).toBe('took 3 actions and took the grey larva cube')
        expect(recapOf([actionOf(ActionType.IntroduceShrimp, 'introduce'), take([])])).toBe(
            'took 1 action and took the grey larva cube'
        )
        expect(recapOf([eat, take([CoralColor.Grey])])).toBe(
            'fed 8 pink polyps to their parrotfish and took the grey larva cube with a grey polyp'
        )
        expect(recapOf([eat])).toBe('fed 8 pink polyps to their parrotfish')
    })

    it('counts each shrimp moved once, however many times it moved', () => {
        const square = (col: number) => ({ boardId: 3, coords: { row: 1, col } })
        const move = (id: string, from: number, to?: number) => ({
            ...actionOf(ActionType.MoveShrimp, id),
            from: square(from),
            ...(to === undefined ? {} : { to: square(to) })
        })
        expect(recapOf([move('a', 1, 2), move('b', 2, 3), move('c', 3), take([])])).toBe(
            'took 1 action and took the grey larva cube'
        )
        expect(recapOf([move('a', 1, 2), move('b', 5, 6), move('c', 2, 3), take([])])).toBe(
            'took 2 actions and took the grey larva cube'
        )
    })
})
