import { describe, expect, it } from 'vitest'
import type { Point } from '@tabletop/common'
import { MAP_IDS, boardMap, type MapId } from '@tabletop/ride-the-rails'
import { boardGeometry, type BoardGeometry } from './boardGeometry.js'
import { capacityMarks } from './cityMarks.js'
import { HEX_LIMIT_MARK, hexLimitMarks } from './terrainMarks.js'
import { insideConvexPolygon } from '$lib/testing/shapeChecks.js'

function squareCorners(center: Point, side: number): Point[] {
    const half = side / 2
    return [
        { x: center.x - half, y: center.y - half },
        { x: center.x + half, y: center.y - half },
        { x: center.x + half, y: center.y + half },
        { x: center.x - half, y: center.y + half }
    ]
}

function insideACell(
    geometry: BoardGeometry,
    hexId: Parameters<BoardGeometry['place']>[0],
    point: Point
) {
    return geometry.place(hexId).cells.some((cell) => insideConvexPolygon(point, cell.vertices))
}

function cityNamed(mapId: MapId, name: string) {
    const city = boardMap(mapId).cities.find((candidate) => candidate.name === name)
    if (!city) throw new Error(`No city ${name} on ${mapId}`)
    return city
}

describe('limit marks inside a hex (R-4.1.4, R-8)', () => {
    it('marks each hex other than a city that holds one locomotive, with a 1', () => {
        const marked = (mapId: MapId) =>
            hexLimitMarks(boardGeometry(mapId)).map((mark) => [mark.hexId, mark.text])
        const longDistance = boardMap('map.au').hexes.filter(
            (hex) => hex.terrain === 'long-distance'
        )
        expect(longDistance).toHaveLength(4)
        expect(marked('map.au')).toEqual(longDistance.map((hex) => [hex.id, '1']))
        const entries = boardMap('map.fr').hexes.filter((hex) =>
            boardMap('map.fr').groupsOf(hex.id).includes('paris-entry')
        )
        expect(entries).toHaveLength(6)
        expect(marked('map.fr')).toEqual(entries.map((hex) => [hex.id, '1']))
        for (const mapId of ['map.usa', 'map.ca', 'map.de'] as const) {
            expect(marked(mapId)).toEqual([])
        }
    })

    it('stands a hex’s mark at its top centre, wholly inside the hex (flat frame)', () => {
        for (const mapId of MAP_IDS) {
            const geometry = boardGeometry(mapId)
            for (const mark of hexLimitMarks(geometry)) {
                const center = geometry.place(mark.hexId).center
                expect(mark.x).toBeCloseTo(center.x)
                expect(mark.y).toBeLessThan(center.y)
                for (const corner of squareCorners(
                    mark,
                    HEX_LIMIT_MARK.side + HEX_LIMIT_MARK.strokeWidth
                )) {
                    expect(insideACell(geometry, mark.hexId, corner), mark.hexId).toBe(true)
                }
            }
        }
    })

    it('stands a no-limit city’s 6 in its hex where no side opens on water, in the sea where one does', () => {
        const markOf = (mapId: MapId, name: string) => {
            const city = cityNamed(mapId, name)
            const mark = capacityMarks(boardGeometry(mapId)).find(
                (found) => found.cityId === city.id
            )
            if (!mark) throw new Error(`No mark for ${name}`)
            return { mark, city }
        }
        expect(markOf('map.ca', 'Toronto').mark).toMatchObject({ text: '6', inHex: false })
        for (const [mapId, name] of [
            ['map.fr', 'Paris'],
            ['map.de', 'Berlin']
        ] as const) {
            const { mark, city } = markOf(mapId, name)
            expect(mark).toMatchObject({ text: '6', inHex: true })
            const geometry = boardGeometry(mapId)
            // Top left of the city's own cell.
            const [cell] = geometry.place(city.hexId).cells
            expect(mark.x).toBeLessThan(cell?.center.x ?? 0)
            expect(mark.y).toBeLessThan(cell?.center.y ?? 0)
            for (const corner of squareCorners(
                mark,
                HEX_LIMIT_MARK.side + HEX_LIMIT_MARK.strokeWidth
            )) {
                expect(insideACell(geometry, city.hexId, corner), name).toBe(true)
            }
        }
    })

    it('keeps every USA capacity mark in the sea, where it was', () => {
        expect(capacityMarks(boardGeometry('map.usa')).every((mark) => !mark.inHex)).toBe(true)
    })
})
