import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap, createCityTileFace } from '@tabletop/18xx'
import { createMapDrawing, type MapRoute } from '../lib/maps/mapDrawing.js'
import { cityOutline, drawMapRoutes } from '../lib/maps/routeDrawing.js'

function cityScene(slots: number) {
    return createMapDrawing(
        new RailwayMap({
            id: 'routes',
            name: 'Routes',
            orientation: HexOrientation.Flat,
            locations: [
                {
                    id: 'A1',
                    coordinates: { q: 0, r: 0 },
                    buildable: true,
                    preprintedTile: createCityTileFace('green', [0, 2, 4], 30, slots)
                }
            ]
        })
    )
}

it.each([1, 2, 3, 4])('outlines a %i-slot city with one closed perimeter', (slots) => {
    const city = cityScene(slots).locations[0].drawing.nodes[0]
    const outline = cityOutline(city)
    expect(outline.match(/M /g)).toHaveLength(1)
    expect(outline.endsWith(' Z')).toBe(true)
    expect(outline).not.toMatch(/NaN|Infinity/)
    expect(outline.match(/A /g)).toHaveLength(slots === 1 ? 2 : slots)
})

it('masks shared cities once while preserving complete track geometry', () => {
    const scene = cityScene(3)
    const [first, second, third] = scene.locations[0].drawing.paths
    const routes: MapRoute[] = [
        {
            id: 'a',
            color: 'red',
            segments: [first, second].map((path) => ({ locationId: 'A1', pathId: path.id }))
        },
        { id: 'b', color: 'blue', segments: [{ locationId: 'A1', pathId: third.id }] }
    ]
    const [drawing] = drawMapRoutes(scene, routes)
    expect(drawing.cities).toHaveLength(1)
    expect(drawing.paths.map((path) => path.d)).toEqual([first.d, second.d, third.d])
    expect(drawMapRoutes(scene, [])).toEqual([])
})

it('dashes an extension and points an arrow into the stop it reaches', () => {
    const scene = cityScene(1)
    const [first, second] = scene.locations[0].drawing.paths
    const city = scene.locations[0].drawing.nodes[0]
    const routes: MapRoute[] = [
        {
            id: 'a',
            color: 'red',
            segments: [{ locationId: 'A1', pathId: first.id }],
            extension: [{ locationId: 'A1', pathId: second.id }]
        }
    ]
    const [drawing] = drawMapRoutes(scene, routes)
    expect(drawing.paths.map((path) => [path.pathId, path.dashed])).toEqual([
        [first.id, false],
        [second.id, true]
    ])
    const [arrow] = drawing.arrows
    const slot = city.slots[0]
    expect(Math.hypot(arrow.tip.x - slot.x, arrow.tip.y - slot.y)).toBeLessThanOrEqual(
        city.slotRadius + 1.5
    )
    const heading = (arrow.angle * Math.PI) / 180
    const ahead = { x: arrow.tip.x + Math.cos(heading), y: arrow.tip.y + Math.sin(heading) }
    expect(Math.hypot(ahead.x - slot.x, ahead.y - slot.y)).toBeLessThan(
        Math.hypot(arrow.tip.x - slot.x, arrow.tip.y - slot.y)
    )
    expect(drawMapRoutes(scene, [{ ...routes[0], extension: undefined }])[0].arrows).toEqual([])
})
