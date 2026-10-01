import { parseTileDefinition, StandardTileCatalog, type TileDefinition } from '@tabletop/18xx'
import { HexOrientation } from '@tabletop/common'
import { PlaygroundTitles } from '../titles.js'
import type { TileInventoryCount } from '@tabletop/18xx'
import { StandardTileLayouts, type TileLayout } from '@tabletop/18xx-ui'

const variant = parseTileDefinition({
    ...StandardTileCatalog.get('18xx:611'),
    id: '1832:611',
    scope: '1832',
    face: { ...StandardTileCatalog.get('18xx:611').face, labels: ['Y'] }
})

const doubleCity = parseTileDefinition({
    id: 'example:double-city',
    printedNumber: 'OO',
    aliases: [],
    scope: 'Layout example',
    face: {
        color: 'green',
        labels: ['OO'],
        nodes: [
            { id: 'west', kind: 'city', stationSlots: 1, revenue: { kind: 'fixed', amount: 20 } },
            { id: 'east', kind: 'city', stationSlots: 1, revenue: { kind: 'fixed', amount: 30 } }
        ],
        paths: [
            {
                id: 'west',
                endpoints: [
                    { kind: 'edge', edge: 1 },
                    { kind: 'node', nodeId: 'west' }
                ]
            },
            {
                id: 'east',
                endpoints: [
                    { kind: 'edge', edge: 4 },
                    { kind: 'node', nodeId: 'east' }
                ]
            }
        ]
    }
})

const offboard = parseTileDefinition({
    id: 'example:offboard',
    printedNumber: 'Port',
    aliases: [],
    scope: 'Layout example',
    face: {
        color: 'red',
        labels: [],
        nodes: [
            {
                id: 'port',
                kind: 'offboard',
                revenue: {
                    kind: 'staged',
                    values: [
                        { stage: 'early', amount: 20 },
                        { stage: 'late', amount: 50 }
                    ]
                }
            }
        ],
        paths: [
            {
                id: 'port',
                endpoints: [
                    { kind: 'edge', edge: 0 },
                    { kind: 'node', nodeId: 'port' }
                ]
            }
        ]
    }
})

const doubleCityCornerRevenues = {
    west: { x: -16, y: 16 * Math.sqrt(3) },
    east: { x: 16, y: -16 * Math.sqrt(3) }
}

export const SpecimenLayouts: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    'example:double-city': {
        nodePositions: { west: { x: -18, y: 0 }, east: { x: 18, y: 0 } },
        revenuePositionsByRotation: { 0: doubleCityCornerRevenues, 3: doubleCityCornerRevenues },
        revenuePositionsByOrientation: { [HexOrientation.Pointy]: doubleCityCornerRevenues }
    }
}

const TitleTileSets = PlaygroundTitles.flatMap((title) => Object.entries(title.tileSets))

export const TileSpecimenGroups: Readonly<Record<string, readonly TileDefinition[]>> = {
    'All specimens': [
        ...new Map(
            [
                ...StandardTileCatalog.entries(),
                ...TitleTileSets.flatMap(([, tileSet]) => tileSet.definitions),
                variant,
                doubleCity,
                offboard
            ].map((tile) => [tile.id, tile])
        ).values()
    ],
    ...Object.fromEntries(TitleTileSets.map(([name, tileSet]) => [name, tileSet.definitions]))
}

export const TileInventoryGroups: Readonly<Record<string, readonly TileInventoryCount[]>> =
    Object.fromEntries(
        TitleTileSets.map(([name, tileSet]) => [name, tileSet.counts(tileSet.createInventory())])
    )
