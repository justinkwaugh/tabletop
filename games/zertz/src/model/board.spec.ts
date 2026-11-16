import { describe, expect, it } from 'vitest'
import { coordinatesToNumber, type AxialCoordinates } from '@tabletop/common'
import { HydratedZertzBoard, type Ring } from './board.js'
import { layoutCoordinates } from './layouts.js'
import { BoardLayout } from '../definition/config.js'
import { MarbleColor } from './marbles.js'

function boardOf(coords: AxialCoordinates[], marbles: [AxialCoordinates, MarbleColor][] = []) {
    const rings: Ring[] = coords.map((ring) => ({ coords: ring }))
    const board = new HydratedZertzBoard({ rings })
    for (const [at, color] of marbles) {
        board.placeMarble(at, color)
    }
    return board
}

function line(length: number): AxialCoordinates[] {
    return Array.from({ length }, (_, q) => ({ q, r: 0 }))
}

describe('layouts', () => {
    it.each([
        [BoardLayout.Rings37, 37],
        [BoardLayout.Rings48, 48]
    ])('%s has %i distinct rings', (layout, count) => {
        const coords = layoutCoordinates(layout)
        expect(coords).toHaveLength(count)
        expect(new Set(coords.map((c) => coordinatesToNumber(c))).size).toBe(count)
    })

    it('the 48 ring board extends the 37 ring board', () => {
        const base = new Set(
            layoutCoordinates(BoardLayout.Rings37).map((c) => coordinatesToNumber(c))
        )
        const large = layoutCoordinates(BoardLayout.Rings48)
        expect(large.filter((c) => base.has(coordinatesToNumber(c)))).toHaveLength(37)
    })
})

describe('free rings', () => {
    const full = layoutCoordinates(BoardLayout.Rings37)

    it('on a fresh board only edge rings are free', () => {
        const board = boardOf(full)
        const free = board.freeRings()
        expect(free).toHaveLength(18)
        expect(
            free.every(
                (ring) =>
                    Math.max(
                        Math.abs(ring.coords.q),
                        Math.abs(ring.coords.r),
                        Math.abs(ring.coords.q + ring.coords.r)
                    ) === 3
            )
        ).toBe(true)
    })

    it('an occupied ring is never free', () => {
        const board = boardOf(full, [[{ q: 3, r: 0 }, MarbleColor.White]])
        expect(board.isFree({ q: 3, r: 0 })).toBe(false)
    })

    it('a ring with open sides that are not adjacent is not free', () => {
        const board = boardOf([
            { q: 0, r: 0 },
            { q: 0, r: -1 },
            { q: 1, r: -1 },
            { q: 0, r: 1 },
            { q: -1, r: 1 }
        ])
        expect(board.isFree({ q: 0, r: 0 })).toBe(false)
    })

    it('a ring with two adjacent open sides is free', () => {
        const board = boardOf([
            { q: 0, r: 0 },
            { q: 0, r: -1 },
            { q: 1, r: -1 },
            { q: 1, r: 0 },
            { q: 0, r: 1 }
        ])
        expect(board.isFree({ q: 0, r: 0 })).toBe(true)
    })
})

describe('jumps', () => {
    it('jumps over an adjacent marble into the vacant ring behind it', () => {
        const board = boardOf(line(3), [
            [{ q: 0, r: 0 }, MarbleColor.White],
            [{ q: 1, r: 0 }, MarbleColor.Black]
        ])
        expect(board.jumpsFrom({ q: 0, r: 0 })).toEqual([
            { from: { q: 0, r: 0 }, over: { q: 1, r: 0 }, to: { q: 2, r: 0 } }
        ])
        const result = board.jump(board.allJumps()[0])
        expect(result).toEqual({ jumper: MarbleColor.White, captured: MarbleColor.Black })
        expect(board.ringAt({ q: 2, r: 0 })?.marble).toBe(MarbleColor.White)
        expect(board.vacantRings()).toHaveLength(2)
    })

    it('cannot jump into an occupied ring or off the board', () => {
        const board = boardOf(line(3), [
            [{ q: 0, r: 0 }, MarbleColor.White],
            [{ q: 1, r: 0 }, MarbleColor.Grey],
            [{ q: 2, r: 0 }, MarbleColor.Black]
        ])
        expect(board.hasAnyJump()).toBe(false)
    })

    it('cannot jump across a gap left by a removed ring', () => {
        const board = boardOf(
            [
                { q: 0, r: 0 },
                { q: 2, r: 0 }
            ],
            [[{ q: 0, r: 0 }, MarbleColor.White]]
        )
        expect(board.hasAnyJump()).toBe(false)
    })
})

describe('groups', () => {
    it('claims only groups with no vacant ring', () => {
        const board = boardOf(
            [
                { q: 0, r: 0 },
                { q: 1, r: 0 },
                { q: 3, r: 0 },
                { q: 4, r: 0 }
            ],
            [
                [{ q: 0, r: 0 }, MarbleColor.White],
                [{ q: 1, r: 0 }, MarbleColor.Grey],
                [{ q: 3, r: 0 }, MarbleColor.Black]
            ]
        )
        expect(board.groups()).toHaveLength(2)
        const claimed = board.claimFullGroups()
        expect(claimed.map((ring) => ring.marble).sort()).toEqual([
            MarbleColor.Grey,
            MarbleColor.White
        ])
        expect(board.rings.map((ring) => ring.coords)).toEqual([
            { q: 3, r: 0 },
            { q: 4, r: 0 }
        ])
    })

    it('claims everything when no vacant ring remains', () => {
        const board = boardOf(line(2), [
            [{ q: 0, r: 0 }, MarbleColor.White],
            [{ q: 1, r: 0 }, MarbleColor.Grey]
        ])
        expect(board.claimFullGroups()).toHaveLength(2)
        expect(board.rings).toHaveLength(0)
    })
})
