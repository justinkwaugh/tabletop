import { describe, expect, it } from 'vitest'
import { getPrng } from '@tabletop/common'
import { Kettle, KETTLE_REACH, type KettleParams } from './kettle.js'

const params: KettleParams = {
    center: { x: 400, y: 300 },
    entrySide: 'left',
    exitSide: 'right',
    size: 5,
    boardWidth: 768,
    boardHeight: 576
}

const DT = 1 / 60

function run(kettle: Kettle, seconds: number, onStep?: () => void) {
    for (let t = 0; t < seconds; t += DT) {
        kettle.step(DT)
        onStep?.()
    }
}

function turnBetween(a: number, b: number): number {
    return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)))
}

describe('vulture kettle', () => {
    it('glides in and wheels over its square without landing or turning sharply', () => {
        for (let seed = 1; seed <= 20; seed++) {
            for (const entrySide of ['left', 'right'] as const) {
                const kettle = new Kettle({ ...params, entrySide }, getPrng(seed))
                let sharpestTurn = 0
                let headings = kettle.vultures.map((vulture) => vulture.heading)
                run(kettle, 16, () => {
                    kettle.vultures.forEach((vulture, i) => {
                        sharpestTurn = Math.max(sharpestTurn, turnBetween(headings[i], vulture.heading))
                    })
                    headings = kettle.vultures.map((vulture) => vulture.heading)
                })
                expect(sharpestTurn).toBeLessThan(0.05)
                for (const vulture of kettle.vultures) {
                    expect(vulture.mode).toBe('soaring')
                    expect(kettle.isOverSquare(vulture.pos)).toBe(true)
                }
            }
        }
    })

    it('stays over its square for a while once there, then every vulture soars off the board', () => {
        const kettle = new Kettle(params, getPrng(5))
        let overhead = 0
        run(kettle, 90, () => {
            if (kettle.vultures.some((vulture) => vulture.mode === 'soaring' && kettle.isOverSquare(vulture.pos))) {
                overhead += DT
            }
        })
        expect(overhead).toBeGreaterThan(15)
        expect(kettle.isGone).toBe(true)
    })

    it('leaves at once when startled', () => {
        const kettle = new Kettle(params, getPrng(7))
        run(kettle, 12)
        kettle.startle()
        expect(kettle.vultures.every((vulture) => vulture.mode === 'departing')).toBe(true)
        run(kettle, 40)
        expect(kettle.isGone).toBe(true)
    })

    it('keeps within reach of its square while wheeling', () => {
        const kettle = new Kettle(params, getPrng(11))
        run(kettle, 16)
        let farthest = 0
        run(kettle, 6, () => {
            for (const vulture of kettle.vultures) {
                farthest = Math.max(farthest, Math.hypot(vulture.pos.x - 400, vulture.pos.y - 300))
            }
        })
        expect(farthest).toBeLessThanOrEqual(KETTLE_REACH)
    })
})
