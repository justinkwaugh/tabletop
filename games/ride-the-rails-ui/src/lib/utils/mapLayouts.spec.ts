import { describe, expect, it } from 'vitest'
import { MAP_IDS, type MapId } from '@tabletop/ride-the-rails'
import type { BoundingBox, RectangleDimensions } from '@tabletop/common'
import { boardGeometry, DESKTOP_BOARD_VIEW, hexBox, type BoardGeometry } from './boardGeometry.js'
import {
    legendBox,
    legendCubeX,
    legendRows,
    legendTextX,
    MAP_LAYOUTS,
    START_LEGEND,
    titleBox
} from './mapLayouts.js'
import { boxesOverlap, boxInside } from '$lib/testing/shapeChecks.js'

// The platform's zoom control, at the board view's bottom-left corner: three 24 px buttons 8 apart
// in a 2 px border with 8 × 4 padding.
const ZOOM_CONTROL = { width: 108, height: 36 }

// Its height is what the header and the panels round it leave: from a phone's under its tallest
// action panel to a 900 px window's with no action area under the board. A building turn at
// 1440 × 900 leaves 611, the desktop view 564.
const VIEW_HEIGHTS = { shortest: 380, tallest: 649 }

// The board views the platform gives from a phone to a 1440 × 900 window, as measured: the board's
// width is the game column's on a 375 × 812 or 390 × 844 phone, and what the sidebar leaves at
// 1024 × 768, 1280 × 900 (and the desktop view the fitted scale is set by), 1366 × 768 and
// 1440 × 900. A 1024-wide window's board is 680 wide, never shorter than a 1024 × 768 window's
// building turn leaves it (478; 516 with no action area), and as tall as a 900 px window's.
const VIEW_WIDTHS: readonly (readonly [string, number, number?])[] = [
    ['375 × 812 phone', 330],
    ['390 × 844 phone', 343],
    ['1024 × 768 window', 680, 478],
    ['1280 × 900 window', 936],
    ['desktop view', DESKTOP_BOARD_VIEW.width],
    ['1366 × 768 window', 1022],
    ['1440 × 900 window', 1096]
]

// The whole board is fitted to every one of those views (a phone's zoomed fully out).
const FITTED_VIEWS: readonly (readonly [string, RectangleDimensions])[] = VIEW_WIDTHS.flatMap(
    ([name, width, shortest = VIEW_HEIGHTS.shortest]) =>
        Array.from({ length: VIEW_HEIGHTS.tallest - shortest + 1 }, (_, step) => {
            const height = shortest + step
            return [`${name}, ${width} × ${height}`, { width, height }] as const
        })
)

/**
 * The zoom control's box in board units with the whole board fitted to the view: the board stands
 * at the view's top, centred across it, and the control in the view's bottom-left corner.
 */
function zoomControlBox(geometry: BoardGeometry, view: RectangleDimensions): BoundingBox {
    const scale = Math.min(view.width / geometry.width, view.height / geometry.height, 1)
    const left = (view.width - geometry.width * scale) / 2
    return {
        x: -left / scale,
        y: (view.height - ZOOM_CONTROL.height) / scale,
        width: ZOOM_CONTROL.width / scale,
        height: ZOOM_CONTROL.height / scale
    }
}

describe('each map’s sea layout', () => {
    for (const mapId of MAP_IDS) {
        const geometry = boardGeometry(mapId)
        const layout = MAP_LAYOUTS[mapId]
        const boxes = [
            ['title', titleBox(layout)],
            ['legend', legendBox(mapId)]
        ] as const

        it(`keeps ${mapId}’s title and legend on the board, in the sea clear of every land hex`, () => {
            for (const [what, box] of boxes) {
                expect(boxInside(box, geometry.extents), what).toBe(true)
                for (const hexId of geometry.hexIds) {
                    expect(boxesOverlap(box, hexBox(hexId)), `${what} over ${hexId}`).toBe(false)
                }
            }
        })

        it(`keeps ${mapId}’s title and legend apart`, () => {
            expect(boxesOverlap(titleBox(layout), legendBox(mapId))).toBe(false)
        })

        it(`keeps ${mapId}’s title and legend clear of the zoom control, the board fitted to every view from a phone’s to 1440 × 900’s, 1024 × 768’s included`, () => {
            const under = FITTED_VIEWS.flatMap(([viewName, view]) => {
                const control = zoomControlBox(geometry, view)
                return boxes
                    .filter(([, box]) => boxesOverlap(box, control))
                    .map(([what]) => `${what} on the ${viewName}`)
            })
            expect(under).toEqual([])
        })
    }

    it('keeps the USA’s title where it was, its legend on the same line right of the zoom control', () => {
        expect(MAP_LAYOUTS['map.usa']).toMatchObject({
            name: 'USA',
            boardLabel: 'Map of the USA',
            title: { x: 1800, y: 118 },
            legend: { x: 284, y: 1196 }
        })
        expect(legendBox('map.usa')).toEqual({ x: 284, y: 992, width: 500, height: 204 })
    })

    it('narrows a legend only where its open sea, or the zoom control, leaves too little room for the usual card', () => {
        expect(Object.fromEntries(MAP_IDS.map((mapId) => [mapId, legendBox(mapId).width]))).toEqual(
            {
                'map.usa': 500,
                'map.au': 520,
                'map.ca': 440,
                'map.fr': 300,
                'map.de': 480
            }
        )
    })

    it('sets the rows’ text past the widest row’s cubes, where the USA’s two always stood', () => {
        expect(legendTextX('map.usa')).toBe(68)
        for (const mapId of MAP_IDS) {
            for (const row of legendRows(mapId)) {
                const lastCube = legendCubeX(row.railroadIds.length - 1)
                expect(lastCube + START_LEGEND.cube / 2, `${mapId} ${row.text}`).toBeLessThan(
                    legendTextX(mapId) - 8
                )
            }
        }
        // Australia’s, Canada’s and France’s printed colour row holds five cubes.
        expect(legendRows('map.au')[0]?.railroadIds).toHaveLength(5)
        expect(legendTextX('map.au')).toBe(134)
    })

    it('stands France’s legend in the Bay of Biscay, above where the zoom control reaches at 1024 × 768', () => {
        expect(MAP_LAYOUTS['map.fr'].legend).toEqual({ x: 16, y: 1464 })
        expect(legendBox('map.fr')).toEqual({ x: 16, y: 1350, width: 300, height: 114 })
    })

    it('stands each expansion map’s legend where its board prints the introduction panel', () => {
        // Its middle in the board's lower left quarter: the open sea nearest the printed panel.
        const southWest = (mapId: MapId) => {
            const { width, height } = boardGeometry(mapId)
            const box = legendBox(mapId)
            return box.x + box.width / 2 <= width / 2 && box.y + box.height / 2 >= height / 2
        }
        expect(southWest('map.au')).toBe(true)
        expect(southWest('map.ca')).toBe(true)
        expect(southWest('map.fr')).toBe(true)
    })

    it('writes one legend row per start rule, Red and Blue sharing theirs', () => {
        expect(legendRows('map.usa')).toEqual([
            { railroadIds: ['railroad.red', 'railroad.blue'], text: 'Different East Coast cities' },
            { railroadIds: ['railroad.orange'], text: 'An East Coast city or Chicago' },
            {
                railroadIds: ['railroad.yellow'],
                text: 'Chicago or the 3 westernmost developed cities'
            },
            { railroadIds: ['railroad.purple'], text: 'A West Coast city' },
            { railroadIds: ['railroad.black'], text: 'Any city with room' }
        ])
    })

    it('leaves Perth and Brisbane, by name from the map, out of Australia’s Black row (R-8.2)', () => {
        const printed = ['railroad.red', 'railroad.blue', 'railroad.orange', 'railroad.yellow']
        expect(legendRows('map.au')).toEqual([
            { railroadIds: [...printed, 'railroad.purple'], text: 'A city of its colour' },
            {
                railroadIds: ['railroad.black'],
                text: 'Any city with room but Perth and Brisbane'
            }
        ])
        for (const mapId of ['map.ca', 'map.fr', 'map.de'] as const) {
            expect(legendRows(mapId).at(-1), mapId).toEqual({
                railroadIds: ['railroad.black'],
                text: 'Any city with room'
            })
        }
    })
})
