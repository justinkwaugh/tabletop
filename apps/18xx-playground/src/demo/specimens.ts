import { parseTileDefinition, StandardTileCatalog, type TileDefinition } from '@tabletop/18xx'
import { HexOrientation } from '@tabletop/common'
import { TheOldPrinceTiles, TheOldPrinceTileSet } from '@tabletop/the-old-prince'
import {
    Shikoku1889Tiles,
    Shikoku1889TileSet,
    Shikoku1889BeginnerTileSet
} from '@tabletop/shikoku-1889'
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

export const TileSpecimenGroups: Readonly<Record<string, readonly TileDefinition[]>> = {
    'All specimens': [
        ...new Map(
            [
                ...StandardTileCatalog.entries(),
                ...TheOldPrinceTiles,
                ...Shikoku1889Tiles,
                variant,
                doubleCity,
                offboard
            ].map((tile) => [tile.id, tile])
        ).values()
    ],
    'The Old Prince 1871': TheOldPrinceTiles,
    'Shikoku 1889': Shikoku1889Tiles,
    'Shikoku 1889 beginner': Shikoku1889BeginnerTileSet.definitions
}

export const TileInventoryGroups: Readonly<Record<string, readonly TileInventoryCount[]>> = {
    'The Old Prince 1871': TheOldPrinceTileSet.counts(TheOldPrinceTileSet.createInventory()),
    'Shikoku 1889': Shikoku1889TileSet.counts(Shikoku1889TileSet.createInventory()),
    'Shikoku 1889 beginner': Shikoku1889BeginnerTileSet.counts(
        Shikoku1889BeginnerTileSet.createInventory()
    )
}
