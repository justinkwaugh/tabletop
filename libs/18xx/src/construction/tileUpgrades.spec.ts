import { describe, expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap, type MapLocation } from '../map/map.js'
import { createCityTileFace, createTrackTileFace } from '../tiles/faces.js'
import { TileSet } from '../tiles/inventory.js'
import { StandardTileCatalog } from '../tiles/standardCatalog.js'
import { sameStopCounts } from './trackUpgrade.js'
import { TileUpgrades, type TileUpgradeRules } from './tileUpgrades.js'

const Tiles = [
    '4',
    '6',
    '7',
    '8',
    '9',
    '57',
    '12',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '53',
    '61',
    '63'
]
const tileSet = new TileSet(
    {
        id: 'upgrades',
        entries: Tiles.map((number) => ({
            id: number,
            faceDefinitionIds: [`18xx:${number}`],
            count: 1
        }))
    },
    [StandardTileCatalog]
)

type Hex = Omit<MapLocation, 'coordinates' | 'buildable'>
const plain: Hex = { id: 'plain', preprintedTile: createTrackTileFace('white', []) }
const city: Hex = { id: 'city', preprintedTile: createCityTileFace('white', [], 0, 1) }

function upgrades(hexes: readonly Hex[], rules: Partial<TileUpgradeRules> = {}): TileUpgrades {
    return new TileUpgrades({
        map: new RailwayMap({
            id: 'upgrades',
            name: 'Upgrades',
            orientation: HexOrientation.Flat,
            locations: hexes.map((hex, q) => ({
                ...hex,
                coordinates: { q, r: 0 },
                buildable: true
            }))
        }),
        tileSet,
        colorOrder: ['white', 'yellow', 'green', 'brown'],
        preservesStops: sameStopCounts,
        ...rules
    })
}

const numbers = (ids: Iterable<string>) => [...ids].map((id) => id.replace('18xx:', '')).sort()

describe('TileUpgrades', () => {
    it('upgrades a tile to the next colour’s tiles keeping its track and stops', () => {
        const graph = upgrades([plain, city])
        expect(numbers(graph.upgradesTo('18xx:9'))).toEqual(['18', '19'])
        expect(numbers(graph.upgradesTo('18xx:8'))).toEqual(['16', '17', '19'])
        expect(numbers(graph.upgradesTo('18xx:57'))).toEqual(['14', '15'])
        expect(numbers(graph.upgradesFrom('18xx:63'))).toEqual(['12', '14', '15'])
    })

    it('labels an upgrade as its hex requires in the upgrade’s colour', () => {
        expect(numbers(upgrades([city]).upgradesTo('18xx:6'))).toEqual(['12', '14', '15'])
        const relabelledInGreen = {
            ...city,
            id: 'green-b',
            upgradeLabels: [{ color: 'green', label: 'B' }]
        }
        expect(numbers(upgrades([relabelledInGreen]).upgradesTo('18xx:6'))).toEqual(['53'])
        expect(numbers(upgrades([city, relabelledInGreen]).upgradesTo('18xx:6'))).toEqual([
            '12',
            '14',
            '15',
            '53'
        ])
        expect(numbers(upgrades([relabelledInGreen]).upgradesTo('18xx:53'))).toEqual(['61'])
    })

    it('keeps an unlabelled tile off a hex labelled from an earlier colour', () => {
        const relabelledInYellow = {
            ...city,
            id: 'yellow-b',
            upgradeLabels: [{ color: 'yellow', label: 'B' }]
        }
        expect(upgrades([city, relabelledInYellow]).upgradesTo('18xx:6')).not.toContain('18xx:53')
    })

    it('upgrades within a colour where the title allows it on the hex', () => {
        const promotes: TileUpgradeRules['upgradesWithinColor'] = (locationId, before, after) =>
            locationId === 'city' &&
            before.nodes[0]?.kind === 'town' &&
            after.nodes[0]?.kind === 'city'
        expect(upgrades([city], { upgradesWithinColor: promotes }).upgradesTo('18xx:4')).toEqual([
            '18xx:57'
        ])
    })

    it('keeps only the tiles with the most exits where the title requires them', () => {
        const graph = upgrades([city], { mostExits: () => true })
        expect(numbers(graph.upgradesTo('18xx:6'))).toEqual(['14', '15'])
    })

    it('chains a tile with every tile it may become and every tile that may become it', () => {
        const graph = upgrades([plain, city])
        expect(numbers(graph.chain('18xx:18'))).toEqual(['18', '7', '9'])
        expect(numbers(graph.chain('18xx:57'))).toEqual(['14', '15', '57', '63'])
    })
})
