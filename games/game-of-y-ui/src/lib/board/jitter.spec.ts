import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { POINTS, type Stone } from '@tabletop/game-of-y'
import { FLAT_VIEW, plan, STONE_RADIUS, TILTED_VIEW } from './geometry.js'
import { seededRandom } from './random.js'
import { stoneOffsets } from './jitter.js'

// Fills the board in a random order, as a game might.
function filledBoard(seed: number): Stone[] {
    const random = seededRandom(seed)
    const points = [...POINTS]
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
        let closest = Infinity
        for (let seed = 1; seed <= 40; seed++) {
            const stones = filledBoard(seed)
            const offsets = stoneOffsets(stones, 6)
            const at = stones.map((stone) => {
                const { x, y } = plan(stone.point)
                const offset = offsets.get(stone.id)!
                return { x: x + offset.x, y: y + offset.y }
            })
            for (let a = 0; a < at.length; a++) {
                for (let b = a + 1; b < at.length; b++) {
                    closest = Math.min(closest, Math.hypot(at[a].x - at[b].x, at[a].y - at[b].y))
                }
            }
        }
        expect(closest).toBeGreaterThanOrEqual(2 * STONE_RADIUS)
    })

    it('keeps a stone where it lay as later stones come', () => {
        const stones = filledBoard(7)
        const early = stoneOffsets(stones.slice(0, 30), 3)
        const late = stoneOffsets(stones, 3)
        for (const [id, offset] of early) expect(late.get(id)).toEqual(offset)
    })

    it('stays within its reach', () => {
        const offsets = stoneOffsets(filledBoard(3), 3)
        for (const { x, y } of offsets.values()) expect(Math.hypot(x, y)).toBeLessThanOrEqual(3)
    })

    it('leans toward a label only into the room it leaves, in either view', () => {
        for (let seed = 1; seed <= 40; seed++) {
            const stones = filledBoard(seed)
            const offsets = stoneOffsets(stones, 12)
            for (const view of [TILTED_VIEW, FLAT_VIEW]) {
                for (const { point, going, spare } of view.labels) {
                    const stone = stones.find((each) => each.point === point)!
                    const { x, y } = offsets.get(stone.id)!
                    expect(x * going.x + y * view.tilt * going.y).toBeLessThanOrEqual(spare + 1e-9)
                }
            }
        }
    })
})
