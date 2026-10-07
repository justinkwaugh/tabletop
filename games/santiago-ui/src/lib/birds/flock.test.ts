import { describe, expect, it } from 'vitest'
import { getPrng, type BoundingBox, type Point } from '@tabletop/common'
import { CLIP_X, CLIP_Y, Flock, type FlockParams } from './flock.js'

const params: FlockParams = {
    cells: [{ x: 300, y: 200, width: 75, height: 75 }],
    nearbyCells: [],
    entrySide: 'left',
    exitSide: 'right',
    size: 5,
    boardWidth: 768,
    boardHeight: 576
}

const DT = 1 / 60

function withinCells(point: Point, cells: BoundingBox[]): boolean {
    return cells.some(
        (c) => point.x >= c.x && point.x <= c.x + c.width && point.y >= c.y && point.y <= c.y + c.height
    )
}

function run(flock: Flock, seconds: number, onStep?: () => void) {
    for (let t = 0; t < seconds; t += DT) {
        flock.step(DT)
        onStep?.()
    }
}

describe('bird flock', () => {
    it.each([1, 2, 3])('lands every bird inside the landing zone (seed %s)', (seed) => {
        const flock = new Flock(params, getPrng(seed))
        run(flock, 12)
        for (const bird of flock.birds) {
            expect(bird.mode).toBe('landed')
            expect(flock.zone.contains(bird.pos)).toBe(true)
        }
    })

    it('keeps landed birds apart and never flies above the clip edge', () => {
        const flock = new Flock(params, getPrng(7))
        run(flock, 45, () => {
            for (const bird of flock.birds) {
                if (bird.mode !== 'gone') expect(bird.pos.y).toBeGreaterThanOrEqual(-CLIP_Y)
            }
            const landed = flock.birds.filter((bird) => bird.mode === 'landed')
            for (const a of landed) {
                for (const b of landed) {
                    if (a !== b) expect(Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y)).toBeGreaterThanOrEqual(6)
                }
            }
        })
    })

    it('leaves as a group once one bird departs, and is gone within the visit budget', () => {
        const flock = new Flock(params, getPrng(11))
        let firstDeparture: number | undefined
        let allDeparting: number | undefined
        let elapsed = 0
        run(flock, 45, () => {
            elapsed += DT
            const departing = flock.birds.filter((bird) => bird.mode !== 'arriving' && bird.mode !== 'landed')
            if (firstDeparture === undefined && departing.length > 0) firstDeparture = elapsed
            if (allDeparting === undefined && departing.length === flock.birds.length) allDeparting = elapsed
        })
        expect(firstDeparture).toBeDefined()
        expect(allDeparting).toBeDefined()
        expect(firstDeparture!).toBeGreaterThan(5)
        expect(allDeparting! - firstDeparture!).toBeLessThan(0.7)
        expect(flock.isGone).toBe(true)
    })

    it('startles into an immediate departure and exits beyond the clip edge', () => {
        const flock = new Flock(params, getPrng(5))
        run(flock, 4)
        flock.startle()
        run(flock, 0.15)
        for (const bird of flock.birds) expect(['departing', 'gone']).toContain(bird.mode)
        run(flock, 6)
        expect(flock.isGone).toBe(true)
        for (const bird of flock.birds) {
            expect(bird.pos.x > params.boardWidth + CLIP_X || bird.pos.y < -CLIP_Y).toBe(true)
        }
    })

    it('spreads over a pair of neighbouring cells and keeps each bird within its own cell', () => {
        const pair: FlockParams = {
            ...params,
            size: 6,
            cells: [
                { x: 300, y: 200, width: 75, height: 75 },
                { x: 300, y: 285, width: 75, height: 75 }
            ]
        }
        const flock = new Flock(pair, getPrng(21))
        run(flock, 12)
        const rows = new Set(flock.birds.map((bird) => (bird.pos.y < 285 ? 'upper' : 'lower')))
        expect(rows.size).toBe(2)
        run(flock, 4, () => {
            for (const bird of flock.birds) {
                if (bird.mode === 'landed') expect(withinCells(bird.pos, pair.cells)).toBe(true)
            }
        })
    })

    it('lets a restless bird relocate to a nearby cell without the flock leaving', () => {
        const nearby = { x: 385, y: 200, width: 75, height: 75 }
        const flock = new Flock({ ...params, size: 6, nearbyCells: [nearby] }, getPrng(13))
        let relocated = false
        let leavingWhenRelocated: boolean | undefined
        let settledNearby = false
        run(flock, 40, () => {
            const mover = flock.birds.find((bird) => bird.mode === 'relocating')
            if (mover && !relocated) {
                relocated = true
                leavingWhenRelocated = flock.leaving
            }
            if (flock.birds.some((bird) => bird.mode === 'landed' && withinCells(bird.pos, [nearby]))) {
                settledNearby = true
            }
        })
        expect(relocated).toBe(true)
        expect(leavingWhenRelocated).toBe(false)
        expect(settledNearby).toBe(true)
    })

    it('alternates poses while flying and rests on the ground once landed', () => {
        const flock = new Flock(params, getPrng(3))
        const poses = new Set<string>()
        run(flock, 1, () => poses.add(flock.birds[0].pose))
        expect(poses.has('fly-a') && poses.has('fly-b')).toBe(true)
        run(flock, 12)
        expect(flock.birds[0].pose).toBe('ground')
    })
})
