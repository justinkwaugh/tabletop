import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, PalaceColor, WallSide } from '@tabletop/medina'
import { describe, expect, it } from 'vitest'
import { historyEntries } from './historyEntries.js'
import { recentPlacements } from './recentPlacements.js'

const base = { gameId: 'g', source: ActionSource.User }

function action<T extends GameAction>(value: T): GameAction {
    return value
}

function merchant(id: string, playerId: string, x: number) {
    return { ...base, id, playerId, type: ActionType.PlaceMerchant, coords: { x, y: 0 } }
}

describe('recent placements', () => {
    const history = [
        merchant('a', 'p0', 0),
        merchant('b', 'p1', 1),
        merchant('c', 'p2', 2),
        merchant('d', 'p0', 3)
    ]

    it('shows the acting player their turn so far and everything since their last one', () => {
        expect(
            recentPlacements(history, { playerId: 'p0', acting: true }).map((p) => p.playerId)
        ).toEqual(['p0', 'p2', 'p1'])
    })

    it('leaves out a waiting player own finished turn', () => {
        expect(recentPlacements(history, { playerId: 'p0', acting: false })).toEqual([])
        expect(
            recentPlacements(history, { playerId: 'p1', acting: false }).map((p) => p.playerId)
        ).toEqual(['p0', 'p2'])
    })

    it('shows a viewer with no seat the latest turn', () => {
        expect(recentPlacements(history, { acting: false }).map((p) => p.playerId)).toEqual(['p0'])
    })

    it('marks a wall by its section and copes with no history yet', () => {
        expect(recentPlacements([], { playerId: 'p0', acting: true })).toEqual([])
        expect(
            recentPlacements(
                [
                    action({
                        ...base,
                        id: 'a',
                        playerId: 'p1',
                        type: ActionType.PlaceWall,
                        side: WallSide.North,
                        position: 2
                    })
                ],
                { playerId: 'p0', acting: true }
            )
        ).toEqual([{ playerId: 'p1', wall: { side: WallSide.North, position: 2 } }])
    })

    it('keeps a building and the rooftop later placed on it as separate placements', () => {
        const space = { x: 9, y: 5 }
        expect(
            recentPlacements(
                [
                    action({
                        ...base,
                        id: 'a',
                        playerId: 'p1',
                        type: ActionType.PlaceBuilding,
                        color: PalaceColor.Purple,
                        coords: space
                    }),
                    action({
                        ...base,
                        id: 'b',
                        playerId: 'p2',
                        type: ActionType.PlaceRooftop,
                        coords: space,
                        neutral: false
                    })
                ],
                { playerId: 'p0', acting: true }
            )
        ).toEqual([
            { playerId: 'p2', roof: space },
            { playerId: 'p1', space }
        ])
    })
})

describe('history entries', () => {
    it('groups a player placements in a row into one turn', () => {
        const nameOf = (playerId: string) => playerId
        const entries = historyEntries(
            [
                merchant('a', 'p0', 0),
                action({
                    ...base,
                    id: 'b',
                    playerId: 'p0',
                    type: ActionType.PlaceBuilding,
                    color: PalaceColor.Grey,
                    coords: { x: 1, y: 1 }
                }),
                merchant('c', 'p1', 2)
            ],
            nameOf
        )
        expect(entries.map((entry) => [entry.playerId, entry.lines.length])).toEqual([
            ['p0', 2],
            ['p1', 1]
        ])
    })

    it('skips actions it cannot describe', () => {
        expect(
            historyEntries(
                [{ ...base, id: 'a', playerId: 'p0', type: 'somethingElse' }],
                (playerId) => playerId
            )
        ).toEqual([])
    })
})
