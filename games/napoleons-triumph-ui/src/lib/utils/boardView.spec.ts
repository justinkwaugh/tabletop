import { describe, expect, it } from 'vitest'
import { Side } from '@tabletop/napoleons-triumph'
import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/map/boardGeometry.js'
import {
    BoardView,
    boundsOf,
    screenAxes,
    toView,
    uprightAngle,
    viewFor,
    viewRotation
} from './boardView.js'

describe('board views', () => {
    it("puts the viewer's own edge of the board at the bottom of the screen", () => {
        const westEdge = { x: 0, y: BOARD_HEIGHT / 2 }
        const eastEdge = { x: BOARD_WIDTH, y: BOARD_HEIGHT / 2 }
        expect(toView(westEdge, viewRotation(viewFor(Side.French))).y).toBe(BOARD_WIDTH)
        expect(toView(eastEdge, viewRotation(viewFor(Side.Allied))).y).toBe(BOARD_WIDTH)
        expect(toView(westEdge, viewRotation(BoardView.North))).toEqual(westEdge)
    })

    it('names board directions that run right and down on screen', () => {
        for (const view of [BoardView.North, BoardView.French, BoardView.Allied]) {
            const rotation = viewRotation(view)
            const { right, down } = screenAxes(rotation)
            const origin = toView({ x: 500, y: 500 }, rotation)
            const toRight = toView({ x: 500 + right.x, y: 500 + right.y }, rotation)
            const below = toView({ x: 500 + down.x, y: 500 + down.y }, rotation)
            expect({ x: toRight.x - origin.x, y: toRight.y - origin.y }).toEqual({ x: 1, y: 0 })
            expect({ x: below.x - origin.x, y: below.y - origin.y }).toEqual({ x: 0, y: 1 })
        }
    })

    it('never leaves a face upside down', () => {
        for (const rotation of [0, 90, -90]) {
            for (let angle = -180; angle <= 180; angle += 15) {
                const onScreen =
                    ((((uprightAngle(angle, rotation) + rotation) % 360) + 540) % 360) - 180
                expect(onScreen).toBeGreaterThan(-90)
                expect(onScreen).toBeLessThanOrEqual(90)
            }
        }
    })

    it('bounds points in view coordinates', () => {
        const rect = boundsOf(
            [
                { x: 100, y: 200 },
                { x: 300, y: 260 }
            ],
            90
        )
        expect(rect).toEqual({ x: BOARD_HEIGHT - 260, y: 100, width: 60, height: 200 })
    })
})
