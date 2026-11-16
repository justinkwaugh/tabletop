import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { HydratedDvonnBoard, spaceFromName, spaceName, type Piece } from '@tabletop/dvonn'
import { boardDiff, spacesBetween } from './boardDiff.js'

// Each piece is named by the space it was placed on, which tells it apart.
const w = (name: string): Piece => ({ playerId: 'w', placedAt: spaceFromName(name) })
const b = (name: string): Piece => ({ playerId: 'b', placedAt: spaceFromName(name) })
const d = (name: string): Piece => ({ dvonn: true, placedAt: spaceFromName(name) })

function board(stacks: Record<string, Piece[]>): HydratedDvonnBoard {
    return new HydratedDvonnBoard({
        stacks: Object.entries(stacks).map(([name, pieces]) => ({
            coords: spaceFromName(name),
            pieces
        }))
    })
}

const names = (list: readonly { coords: AxialCoordinates }[]) =>
    list.map((stack) => spaceName(stack.coords)).toSorted()

describe('boardDiff', () => {
    const before = board({ A1: [w('A1')], B1: [b('B1'), d('C1')], E3: [b('E3')], F3: [w('F3')] })
    const after = board({ B1: [b('B1'), d('C1'), w('A1')] })

    it('reads a move and the stacks it cut off', () => {
        const diff = boardDiff(before, after)
        expect(diff.moved).toEqual([
            {
                from: spaceFromName('A1'),
                to: spaceFromName('B1'),
                pieces: [w('A1')],
                leftBelow: 0,
                landingOn: 2
            }
        ])
        expect(names(diff.vanished)).toEqual(['E3', 'F3'])
        expect(diff.appeared).toEqual([])
    })

    it('reads the same move backward for undo', () => {
        const diff = boardDiff(after, before)
        expect(diff.moved).toEqual([
            {
                from: spaceFromName('B1'),
                to: spaceFromName('A1'),
                pieces: [w('A1')],
                leftBelow: 2,
                landingOn: 0
            }
        ])
        expect(names(diff.appeared)).toEqual(['E3', 'F3'])
        expect(diff.vanished).toEqual([])
    })

    it('follows each piece across several moves', () => {
        const start = board({ A1: [w('A1')], B1: [b('B1')], D1: [w('D1')], E1: [d('E1')] })
        // A1 onto B1, then that stack onto D1, then E1's DVONN piece stays.
        const end = board({ D1: [w('D1'), b('B1'), w('A1')], E1: [d('E1')] })
        const moved = boardDiff(start, end).moved
        expect(moved.map((motion) => [spaceName(motion.from), spaceName(motion.to)])).toEqual([
            ['B1', 'D1'],
            ['A1', 'D1']
        ])
        expect(moved.map((motion) => motion.landingOn)).toEqual([1, 2])
    })

    it('reads a placement and its undo as a stack appearing and vanishing', () => {
        const empty = board({})
        const placed = board({ C2: [w('C2')] })
        expect(names(boardDiff(empty, placed).appeared)).toEqual(['C2'])
        expect(names(boardDiff(placed, empty).vanished)).toEqual(['C2'])
    })
})

describe('spacesBetween', () => {
    it('lists the spaces a hop passes over', () => {
        const between = spacesBetween(spaceFromName('A1'), spaceFromName('D1'))
        expect(between.map(spaceName)).toEqual(['B1', 'C1'])
        expect(spacesBetween(spaceFromName('A1'), spaceFromName('B1'))).toEqual([])
    })

    it('passes over no space between spaces off one line', () => {
        expect(spacesBetween(spaceFromName('A1'), spaceFromName('C2'))).toEqual([])
    })
})
