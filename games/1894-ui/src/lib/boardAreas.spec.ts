import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assertExists, calculateHexGeometry, HexOrientation } from '@tabletop/common'
import {
    EighteenNinetyFourMap,
    EighteenNinetyFourMarket,
    EighteenNinetyFourTileSet,
    SplitCityTiles
} from '@tabletop/1894'
import { createMapDrawing } from '@tabletop/18xx-ui'
import {
    MarketScenePadding,
    marketGeometry
} from '../../../../libs/18xx-ui/src/lib/stock/marketTokenLayout.js'
import { EighteenNinetyFourMapView, EighteenNinetyFourSharedCityLayouts } from './mapView.js'
import { EighteenNinetyFourPresentation } from './presentation.js'

describe('1894 board', () => {
    const scene = createMapDrawing(
        EighteenNinetyFourMap,
        {
            tileSet: EighteenNinetyFourTileSet,
            inventory: EighteenNinetyFourTileSet.createInventory(),
            markers: []
        },
        { ...EighteenNinetyFourMapView, drawingStyle: { cityNameArcs: true } }
    )

    it('keeps every straight name inside its pointy hex', () => {
        const halfWidthAt = (y: number) =>
            Math.abs(y) <= 25 ? 43.3 : (43.3 * Math.max(0, 50 - Math.abs(y))) / 25
        for (const entry of scene.locations) {
            if (!entry.nameShown || entry.nameArcs.length) continue
            const fontSize = entry.nameStyle?.fontSize ?? 5
            entry.nameRows.forEach((row, index) => {
                const baseline = entry.nameBaseline.y + (index * 6 * fontSize) / 5
                const reach = Math.abs(entry.nameBaseline.x) + (row.length * 0.6 * fontSize) / 2
                expect(reach, `${row} in ${entry.location.id}`).toBeLessThanOrEqual(
                    Math.min(halfWidthAt(baseline - 0.8 * fontSize), halfWidthAt(baseline))
                )
            })
        }
    })

    it('prints the Netherlands bonus on the table, clear of the market', () => {
        const netherlands = scene.locations.find((entry) => entry.location.id === 'C18')
        const market = EighteenNinetyFourMapView.boardAreas?.market
        assertExists(netherlands, 'The map has the Netherlands')
        assertExists(market, 'The board has a market area')
        const longestLine = 16 * 0.6 * 9
        expect(netherlands.center.x + longestLine / 2).toBeLessThan(market.x)
    })

    it('hides the LSQG marker once Saint-Quentin à Guise closes', () => {
        const artFor = EighteenNinetyFourPresentation.markerArtFor
        assertExists(artFor, 'The title has played marker art')
        const { state } = JSON.parse(
            readFileSync(new URL('../scenarios/privates-close.json', import.meta.url), 'utf8')
        )
        const closed = (isClosed: boolean) =>
            artFor({
                ...state,
                companies: state.companies.map((company: { id: string }) =>
                    company.id === 'SQG' ? { ...company, closed: isClosed } : company
                )
            })
        expect(closed(false)).toEqual({})
        expect(closed(true)).toEqual({ G10: { SQG: { hidden: true } } })
    })

    it('fits two stations in either city of every split tile', () => {
        const splitTiles = Object.values(SplitCityTiles).flat()
        expect(Object.keys(EighteenNinetyFourSharedCityLayouts).sort()).toEqual(
            [...splitTiles].sort()
        )
        for (const definitionId of splitTiles) {
            for (const nodeId of ['city-0', 'city-1']) {
                const inventory = EighteenNinetyFourTileSet.createInventory([
                    { locationId: 'C4', definitionId, rotation: 0 }
                ])
                const entry = createMapDrawing(
                    EighteenNinetyFourMap,
                    {
                        tileSet: EighteenNinetyFourTileSet,
                        inventory,
                        overfullCities: [`C4 ${nodeId}`]
                    },
                    { ...EighteenNinetyFourMapView, drawingStyle: { citySlotRadius: 14.4 } }
                ).locations.find((location) => location.location.id === 'C4')
                assertExists(entry, 'The map has the hex')
                const shared = entry.drawing.nodes.find(({ node }) => node.id === nodeId)
                const other = entry.drawing.nodes.find(({ node }) => node.id !== nodeId)
                assertExists(shared, 'The tile has the shared city')
                assertExists(other, 'The tile has the other city')
                expect(shared.slots, `${definitionId} ${nodeId}`).toHaveLength(2)
                for (const slot of shared.slots) {
                    expect(
                        Math.hypot(slot.x - other.center.x, slot.y - other.center.y),
                        `${definitionId} ${nodeId} clear of the other city`
                    ).toBeGreaterThan(2 * 14.4)
                    for (const degrees of [0, 60, 120, 180, 240, 300]) {
                        const angle = (degrees * Math.PI) / 180
                        expect(
                            slot.x * Math.cos(angle) + slot.y * Math.sin(angle) + 14.4,
                            `${definitionId} ${nodeId} inside the hex`
                        ).toBeLessThan(43.3)
                    }
                }
            }
        }
    })

    it('keeps the LSQG marker on Saint-Quentin’s tile as a tag', () => {
        const saintQuentin = (
            inventory: ReturnType<typeof EighteenNinetyFourTileSet.createInventory>
        ) =>
            createMapDrawing(
                EighteenNinetyFourMap,
                { tileSet: EighteenNinetyFourTileSet, inventory },
                EighteenNinetyFourMapView
            ).locations.find((location) => location.location.id === 'G10')
        expect(
            saintQuentin(EighteenNinetyFourTileSet.createInventory())?.localLineOnTile
        ).toBeUndefined()
        const onTile = saintQuentin(
            EighteenNinetyFourTileSet.createInventory([
                { locationId: 'G10', definitionId: '18xx:14', rotation: 0 }
            ])
        )
        expect(onTile?.localLineOnTile).toBeDefined()
        expect(onTile?.location.markers?.map((marker) => marker.id)).toContain('SQG')
    })

    it('boxes Luxembourg’s value where its revenue stands', () => {
        const luxembourg = scene.locations.find((entry) => entry.location.id === 'I18')
        assertExists(luxembourg, 'The map has Luxembourg')
        const [box] = luxembourg.revenueAnnotations
        expect(box).toMatchObject({ kind: 'box', label: 'Largest' })
        const { revenuePosition } = luxembourg.drawing.nodes[0]
        expect(box.x).toBeCloseTo(revenuePosition.x)
        expect(box.y).toBeCloseTo(revenuePosition.y)
    })

    it('keeps every drawn market cell and the depot clear of every hex and each other', () => {
        const areas = EighteenNinetyFourMapView.boardAreas
        // A pointy hex of radius 50 reaches 43.3 across and 50 up and down from its centre.
        const hexes = EighteenNinetyFourMapView.map.definition.locations.map(
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
        const geometry = marketGeometry(
            EighteenNinetyFourMarket,
            EighteenNinetyFourPresentation.marketCell,
            EighteenNinetyFourPresentation.marketZones
        )
        const width = 2 * MarketScenePadding + geometry.width
        const height = 2 * MarketScenePadding + geometry.height
        const area = areas?.market
        const depot = areas?.depot
        assertExists(area, 'The board has a market area')
        assertExists(depot, 'The board has a depot area')
        const scale = Math.min(area.width / width, area.height / height)
        const left = area.x + (area.width - width * scale) / 2
        for (const space of EighteenNinetyFourMarket.spaces) {
            const x = left + (MarketScenePadding + geometry.columnLefts[space.column]) * scale
            const y = area.y + (MarketScenePadding + space.row * geometry.cell.height) * scale
            const cellWidth = geometry.cell.width * scale
            const cellHeight = geometry.cell.height * scale
            expect(clear(x, y, cellWidth, cellHeight)).toBe(true)
            expect(
                x + cellWidth < depot.x ||
                    x > depot.x + depot.width ||
                    y + cellHeight < depot.y ||
                    y > depot.y + depot.height
            ).toBe(true)
        }
        expect(clear(depot.x, depot.y, depot.width, depot.height)).toBe(true)
    })
})
