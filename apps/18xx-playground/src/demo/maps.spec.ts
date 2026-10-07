import { Presentation1846 } from '../../../../games/1846-ui/src/lib/presentation.js'
import { MapView1846 } from '../../../../games/1846-ui/src/lib/mapView.js'
import { createMarket as create1846Market } from '../../../../games/1846/src/stock.js'
import { describe, expect, it } from 'vitest'
import { createMapDrawing, mapSelectionPoint, assertMapOverlays } from '@tabletop/18xx-ui'
import { rotateTileEdge, type RailwayMap } from '@tabletop/18xx'
import { MapExamples } from './maps.js'
import { calculateHexGeometry, HexOrientation } from '@tabletop/common'
import { createEighteenThirtyStockMarket } from '@tabletop/1830'
import { EighteenThirtyMapView } from '@tabletop/1830-ui'
import { createEighteenSeventeenStockMarket } from '@tabletop/1817'
import { EighteenSeventeenMapView } from '@tabletop/1817-ui'
import { createEighteenThirtyTwoStockMarket } from '@tabletop/1832'
import { EighteenThirtyTwoMapView } from '@tabletop/1832-ui/playground'
import {
    MarketCellHeight,
    MarketCellWidth,
    MarketScenePadding,
    MarketZoneBannerHeight
} from '../../../../libs/18xx-ui/src/lib/stock/marketTokenLayout.js'

type MapScene = ReturnType<typeof createMapDrawing>

// Counts drawn track ends that meet a neighbor at the shared edge midpoint, failing on any that don't.
function alignedEdges(
    scene: MapScene,
    map: RailwayMap,
    include: (entry: MapScene['locations'][number]) => boolean = () => true
): number {
    let checked = 0
    for (const entry of scene.locations.filter(include)) {
        for (const path of entry.drawing.paths) {
            expect(path.d).not.toMatch(/NaN|Infinity|undefined/)
            for (const [index, endpoint] of entry.face.paths
                .find((candidate) => candidate.id === path.id)!
                .endpoints.entries()) {
                if (endpoint.kind !== 'edge') continue
                const neighbor = map.neighbor(
                    entry.location.id,
                    rotateTileEdge(endpoint.edge, entry.rotation)
                )
                if (!neighbor) continue
                checked++
                const other = scene.locations.find(
                    (candidate) => candidate.location.id === neighbor.id
                )!
                const point = index === 0 ? path.start : path.end
                expect(entry.center.x + point.x).toBeCloseTo(
                    (entry.center.x + other.center.x) / 2,
                    1
                )
                expect(entry.center.y + point.y).toBeCloseTo(
                    (entry.center.y + other.center.y) / 2,
                    1
                )
            }
        }
    }
    return checked
}

describe('complete title maps', () => {
    it.each(Object.values(MapExamples))(
        'preserves location facts and aligns map edges for $map.definition.name',
        (example) => {
            const scene = createMapDrawing(example.map, undefined, { layouts: example.layouts })
            expect(alignedEdges(scene, example.map)).toBeGreaterThan(10)
            const prepared = createMapDrawing(
                example.map,
                { tileSet: example.tileSet, inventory: example.prepared },
                { layouts: example.layouts }
            )
            expect(prepared.locations.filter((entry) => entry.placed)).toHaveLength(1)
            alignedEdges(prepared, example.map, (entry) => entry.placed)
            for (const entry of prepared.locations)
                expect(entry.location).toBe(example.map.location(entry.location.id))
            expect(() => assertMapOverlays(prepared, example.tokens, example.routes)).not.toThrow()
            const token = example.tokens[0]
            const point = mapSelectionPoint(prepared, { kind: 'slot', ...token })
            expect(Number.isFinite(point.x + point.y)).toBe(true)
            expect(() => assertMapOverlays(prepared, [{ ...token, slot: 99 }], [])).toThrow('slot')
            expect(() =>
                assertMapOverlays(prepared, [token, { ...token, id: 'duplicate' }], [])
            ).toThrow('Multiple tokens')
        }
    )
    it('aligns the 1846 preprint and every phase-I tile orientation with neighboring hexes', () => {
        const view = MapView1846
        const scene = createMapDrawing(view.map, undefined, view)
        expect(alignedEdges(scene, view.map)).toBeGreaterThan(30)
        for (const rotation of [0, 1, 2, 3, 4, 5] as const) {
            const prepared = createMapDrawing(
                view.map,
                {
                    tileSet: view.tileSet,
                    inventory: view.tileSet.createInventory([
                        { locationId: 'C13', definitionId: '18xx:7', rotation }
                    ])
                },
                view
            )
            alignedEdges(prepared, view.map, (entry) => entry.placed)
        }
    })
    it('draws a rotated pointy-hex tile meeting both neighbors', () => {
        const example = MapExamples['1830']
        const prepared = createMapDrawing(
            example.map,
            { tileSet: example.tileSet, inventory: example.prepared },
            { layouts: example.layouts }
        )
        expect(alignedEdges(prepared, example.map, (entry) => entry.placed)).toBe(2)
    })
    it('includes every location and title-specific printed rule', () => {
        const top = MapExamples.TOP.map
        const shikoku = MapExamples['1889'].map
        expect(top.definition.locations).toHaveLength(110)
        expect(shikoku.definition.locations).toHaveLength(52)
        expect(top.location('G11').preprintedTile.nodes[0]).toMatchObject({
            kind: 'city',
            stationSlots: 0
        })
        expect(top.location('N18').markers?.[0].id).toBe('vernon-river-bridge')
        expect(top.location('L16').upgradeLabels).toEqual([{ color: 'gray', label: 'CX' }])
        expect(shikoku.location('H5').terrain).toEqual({ cost: 80, kinds: ['water', 'mountain'] })
        expect(shikoku.location('I4').terrain?.kinds).toEqual([])
        expect(
            shikoku.definition.locations.filter((location) =>
                location.markers?.some((marker) => marker.id === 'port')
            )
        ).toHaveLength(4)
        expect(shikoku.location('F1').preprintedTile.nodes[0]).toMatchObject({
            revenue: {
                kind: 'staged',
                values: [
                    { stage: 'yellow', amount: 30 },
                    { stage: 'brown', amount: 60 },
                    { stage: 'diesel', amount: 100 }
                ]
            }
        })
    })
})

describe.each([
    {
        name: '1846',
        view: MapView1846,
        createMarket: create1846Market,
        cell: Presentation1846.marketCell,
        zones: Presentation1846.marketZones
    },
    { name: '1830', view: EighteenThirtyMapView, createMarket: createEighteenThirtyStockMarket },
    {
        name: '1817',
        view: EighteenSeventeenMapView,
        createMarket: createEighteenSeventeenStockMarket
    },
    {
        name: '1832',
        view: EighteenThirtyTwoMapView,
        createMarket: createEighteenThirtyTwoStockMarket
    }
])('$name board', ({ view, createMarket, cell, zones }) => {
    it('keeps every drawn market cell and the depot clear of every hex', () => {
        const areas = view.boardAreas
        expect(areas?.market && areas.depot).toBeTruthy()
        const hexes = view.map.definition.locations.map(
            (location) =>
                calculateHexGeometry(
                    { orientation: HexOrientation.Pointy, dimensions: { radius: 50 } },
                    location.coordinates
                ).center
        )
        const clear = (x: number, y: number, width: number, height: number) =>
            hexes.every(
                (hex) =>
                    x + width < hex.x - 55.3 ||
                    x > hex.x + 55.3 ||
                    y + height < hex.y - 62 ||
                    y > hex.y + 62
            )
        const market = createMarket()
        const cells = market.spaces.map((space) => space.id.split(':').map(Number))
        const columns = Math.max(...cells.map(([, column]) => column)) + 1
        const rows = Math.max(...cells.map(([row]) => row)) + 1
        const cellWidth = cell?.width ?? MarketCellWidth
        const cellHeight = cell?.height ?? MarketCellHeight
        const banner = zones?.some((zone) => zone.banner) ? MarketZoneBannerHeight : 0
        const width = 2 * MarketScenePadding + columns * cellWidth
        const height = 2 * MarketScenePadding + banner + rows * cellHeight
        const area = areas!.market!
        const scale = Math.min(area.width / width, area.height / height)
        const left = area.x + (area.width - width * scale) / 2
        for (const [row, column] of cells)
            expect(
                clear(
                    left + (MarketScenePadding + column * cellWidth) * scale,
                    area.y + (MarketScenePadding + banner + row * cellHeight) * scale,
                    cellWidth * scale,
                    cellHeight * scale
                )
            ).toBe(true)
        const depot = areas!.depot!
        expect(clear(depot.x, depot.y, depot.width, depot.height)).toBe(true)
    })
})
