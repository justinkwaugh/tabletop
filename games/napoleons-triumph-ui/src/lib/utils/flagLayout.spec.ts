import { describe, expect, it } from 'vitest'
import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
import { attackMarkerSamples } from './attackMarker.js'
import { BoardView, viewRotation } from './boardView.js'
import { FlagSide, arrowsToKeepClear, placeFlags } from './flagLayout.js'

const NORTH = { rotation: viewRotation(BoardView.North), scale: 1 }

function blockAt(x: number, y: number) {
    return { centre: { x, y }, angle: 0 }
}

describe('which way a flag flies', () => {
    const foot = { x: 500, y: 500 }
    const flag = { key: 'corps', feetByPreference: [foot], width: 150 }

    it('is to the right when nothing is in the way', () => {
        expect(placeFlags([flag], [], NORTH)).toEqual({ corps: { foot, side: FlagSide.Right } })
    })

    it('is to the left when the right would lie across another stack', () => {
        const neighbour = blockAt(590, 480)
        expect(placeFlags([flag], [neighbour], NORTH).corps.side).toBe(FlagSide.Left)
    })

    it('stays to the right when the left is no clearer', () => {
        const blocks = [blockAt(590, 480), blockAt(410, 480)]
        expect(placeFlags([flag], blocks, NORTH).corps.side).toBe(FlagSide.Right)
    })

    it('keeps clear of a flag already flying', () => {
        const beside = { key: 'beside', feetByPreference: [{ x: 560, y: 500 }], width: 150 }
        const placed = placeFlags([beside, flag], [], NORTH)
        expect(placed.beside.side).toBe(FlagSide.Right)
        expect(placed.corps.side).toBe(FlagSide.Left)
    })

    it('judges left and right as the board is turned', () => {
        const turned = { rotation: viewRotation(BoardView.Allied), scale: 1 }
        const rightOnScreen = blockAt(520, 410)
        expect(placeFlags([flag], [rightOnScreen], turned).corps.side).toBe(FlagSide.Left)
        expect(placeFlags([flag], [rightOnScreen], NORTH).corps.side).toBe(FlagSide.Right)
    })
})

describe('where a flag stands', () => {
    const near = { x: 500, y: 500 }
    const far = { x: 604, y: 500 }
    const flag = { key: 'corps', feetByPreference: [near, far], width: 150 }

    function arrowAt(x: number, y: number) {
        const pointingDown = { centre: { x, y }, angle: 0, length: 131, inward: { x: 0, y: -1 } }
        return attackMarkerSamples(pointingDown, 1)
    }

    it('is the first place offered when it is clear', () => {
        expect(placeFlags([flag], [], NORTH).corps.foot).toEqual(near)
    })

    it('moves along the stack rather than stand on the attack arrow', () => {
        expect(placeFlags([flag], [], NORTH, arrowAt(500, 485)).corps).toEqual({
            foot: far,
            side: FlagSide.Right
        })
    })

    it('would sooner lie across a neighbouring stack than across the attack arrow', () => {
        const onlyHere = { ...flag, feetByPreference: [near] }
        const neighbourToTheLeft = blockAt(420, 480)
        const placed = placeFlags([onlyHere], [neighbourToTheLeft], NORTH, arrowAt(560, 480))
        expect(placed.corps.side).toBe(FlagSide.Left)
    })
})

describe('the arrows flags keep clear of', () => {
    const [first, second] = Object.keys(APPROACH_GEOMETRY).map(Number)

    function farthestFrom(approach: number, zoom: number): number {
        const { centre } = APPROACH_GEOMETRY[approach]
        return Math.max(
            ...arrowsToKeepClear([approach], zoom).map((point) =>
                Math.hypot(point.x - centre.x, point.y - centre.y)
            )
        )
    }

    it('lie on the approaches that carry an arrow, and nowhere when none does', () => {
        expect(arrowsToKeepClear([], 0.5)).toEqual([])
        expect(arrowsToKeepClear([first, second], 0.5)).toEqual([
            ...arrowsToKeepClear([first], 0.5),
            ...arrowsToKeepClear([second], 0.5)
        ])
        expect(farthestFrom(first, 0.5)).toBeLessThan(80)
    })

    it('reach farther as the board is zoomed out, because the arrows keep a readable size', () => {
        expect(farthestFrom(first, 0.25)).toBeGreaterThan(farthestFrom(first, 0.5))
    })
})
