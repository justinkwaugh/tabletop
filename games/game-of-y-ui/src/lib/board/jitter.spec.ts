import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { BoardShape, gridOf, type Stone } from '@tabletop/game-of-y'
import { boardView, planOf, STONE_RADIUS } from './geometry.js'
import { seededRandom } from './random.js'
import { stoneOffsets } from './jitter.js'

const SHAPES = Object.values(BoardShape)

// Fills the board in a random order, as a game might.
function filledBoard(shape: BoardShape, seed: number): Stone[] {
    const random = seededRandom(seed)
    const points = [...gridOf(shape).points]
    for (let index = points.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1))
        ;[points[index], points[other]] = [points[other], points[index]]
    }
    return points.map((point, id) => ({
        id,
        point,
        color: id % 2 === 0 ? Color.Black : Color.White
    }))
}

describe('loose stones', () => {
    it('never lets two stones overlap, however the board filled', () => {
        for (const shape of SHAPES) {
            let closest = Infinity
            for (let seed = 1; seed <= 12; seed++) {
                const stones = filledBoard(shape, seed)
                const offsets = stoneOffsets(shape, stones, 12)
                const at = stones.map((stone) => {
                    const { x, y } = planOf(shape, stone.point)
                    const offset = offsets.get(stone.id)!
                    return { x: x + offset.x, y: y + offset.y }
                })
                for (let a = 0; a < at.length; a++) {
                    for (let b = a + 1; b < at.length; b++) {
                        closest = Math.min(
                            closest,
                            Math.hypot(at[a].x - at[b].x, at[a].y - at[b].y)
                        )
                    }
                }
            }
            expect(closest).toBeGreaterThanOrEqual(2 * STONE_RADIUS)
        }
    })

    it('keeps a stone where it lay as later stones come', () => {
        const stones = filledBoard(BoardShape.Kadon, 7)
        const early = stoneOffsets(BoardShape.Kadon, stones.slice(0, 30), 3)
        const late = stoneOffsets(BoardShape.Kadon, stones, 3)
        for (const [id, offset] of early) expect(late.get(id)).toEqual(offset)
    })

    it('stays within its reach', () => {
        const offsets = stoneOffsets(BoardShape.Hex13, filledBoard(BoardShape.Hex13, 3), 3)
        for (const { x, y } of offsets.values()) expect(Math.hypot(x, y)).toBeLessThanOrEqual(3)
    })

    it('leans toward a label only into the room it leaves, in either view', () => {
        for (const shape of SHAPES) {
            for (let seed = 1; seed <= 12; seed++) {
                const stones = filledBoard(shape, seed)
                const offsets = stoneOffsets(shape, stones, 12)
                for (const view of [false, true].map((flat) => boardView(shape, flat))) {
                    for (const { point, going, spare } of [...view.labels, ...view.cellLabels]) {
                        const stone = stones.find((each) => each.point === point)!
                        const { x, y } = offsets.get(stone.id)!
                        expect(x * going.x + y * view.tilt * going.y).toBeLessThanOrEqual(
                            spare + 1e-9
                        )
                    }
                }
            }
        }
    })
})
