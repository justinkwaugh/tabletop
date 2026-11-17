import { describe, expect, it } from 'vitest'
import { MAP_IDS } from '@tabletop/ride-the-rails'
import { boardGeometry, hexBox } from './boardGeometry.js'
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
    }

    it('keeps the USA’s title and legend where they were', () => {
        expect(MAP_LAYOUTS['map.usa']).toMatchObject({
            name: 'USA',
            boardLabel: 'Map of the USA',
            title: { x: 1800, y: 118 },
            legend: { x: 52, y: 1196 }
        })
        expect(legendBox('map.usa')).toEqual({ x: 52, y: 992, width: 610, height: 204 })
    })

    it('narrows only Germany’s legend, whose North Sea is too narrow for the usual card', () => {
        for (const mapId of MAP_IDS) {
            expect([mapId, legendBox(mapId).width]).toEqual([
                mapId,
                mapId === 'map.de' ? 480 : START_LEGEND.width
            ])
        }
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
})
