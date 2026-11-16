import { describe, expect, it } from 'vitest'
import { TileUpgrades, requiredLabels, sameLabels } from '@tabletop/18xx'
import { KharkovLocationId, Map1861, MoscowLocationId, StPetersburgLocationId } from './map.js'
import { TileColorOrder1861, TileSet1861, Tiles1861, preservesStops1861 } from './tiles.js'

const count = (number: string) =>
    TileSet1861.pieces.filter((piece) =>
        piece.faceDefinitionIds.some((id) => id.split(':')[1] === number)
    ).length

const upgrades = new TileUpgrades({
    map: Map1861,
    tileSet: TileSet1861,
    colorOrder: TileColorOrder1861,
    preservesStops: preservesStops1861
})
const numbers = (ids: readonly string[]) =>
    ids.map((id) => id.split(':')[1]).toSorted((a, b) => Number(a) - Number(b))
const definitionId = (number: string) => {
    const tile = Tiles1861.find((candidate) => candidate.printedNumber === number)
    if (!tile) throw new Error(number)
    return tile.id
}

function layableOn(locationId: string): string[] {
    const location = Map1861.location(locationId)
    const printed = location.preprintedTile
    return Tiles1861.filter(
        (tile) =>
            TileColorOrder1861.indexOf(tile.face.color) ===
                TileColorOrder1861.indexOf(printed.color) + 1 &&
            sameLabels(
                requiredLabels(location, tile.face.color, TileColorOrder1861, printed.labels),
                tile.face.labels
            )
    ).map((tile) => tile.printedNumber)
}

// The Tile Upgrade Chart (§18).
const Chart: Readonly<Record<string, readonly string[]>> = {
    '3': ['87', '88', '204'],
    '4': ['87', '88', '204'],
    '5': ['14', '15', '619'],
    '6': ['14', '15', '619'],
    '7': ['18', '21', '22', '26', '27', '28', '29', '30', '31', '624', '625', '626'],
    '8': ['16', '17', '19', '21', '22', '23', '24', '25', '28', '29', '30', '31'],
    '9': ['18', '19', '20', '23', '24', '26', '27'],
    '57': ['14', '15', '619'],
    '58': ['87', '88', '204'],
    '201': ['207', '208', '622'],
    '202': ['207', '208', '622'],
    '621': ['207', '208', '622'],
    '14': ['63', '611'],
    '15': ['63', '611'],
    '16': ['43'],
    '17': ['47'],
    '18': ['43'],
    '19': ['45', '46'],
    '20': ['44', '47'],
    '21': ['46'],
    '22': ['45'],
    '23': ['41', '43', '45', '47'],
    '24': ['42', '43', '46', '47'],
    '25': ['40', '45', '46'],
    '26': ['42', '44', '45'],
    '27': ['41', '44', '46'],
    '28': ['39', '43', '46'],
    '29': ['39', '43', '45'],
    '30': ['42'],
    '31': ['41'],
    '87': ['911'],
    '88': ['911'],
    '204': ['911'],
    '207': ['623', '801'],
    '208': ['623'],
    '619': ['63', '611'],
    '622': ['623'],
    '624': ['39'],
    '625': [],
    '626': ['44'],
    '635': ['636'],
    '637': ['638'],
    '623': ['640'],
    '638': ['639'],
    '641': ['642']
}

describe('the tiles', () => {
    it('match the chart’s counts (§18), with plain yellow track unlimited (§10.4)', () => {
        expect(['3', '4', '5', '6', '57', '58', '201', '202', '621'].map(count)).toEqual([
            2, 4, 2, 2, 2, 4, 3, 3, 2
        ])
        expect(['23', '24', '25', '207', '624', '63', '611', '623', '911'].map(count)).toEqual([
            5, 5, 4, 5, 1, 3, 3, 3, 3
        ])
        expect(['635', '636', '637', '638', '639', '640', '641', '642'].map(count)).toEqual([
            1, 1, 1, 1, 1, 1, 1, 1
        ])
        expect(
            TileSet1861.manifest.entries
                .filter((entry) => entry.count === 'unlimited')
                .map(({ id }) => id)
        ).toEqual(['7', '8', '9'])
    })

    it('upgrade as the chart shows (§18)', () => {
        for (const [number, next] of Object.entries(Chart))
            expect(numbers(upgrades.upgradesTo(definitionId(number))), number).toEqual(
                [...next].toSorted((a, b) => Number(a) - Number(b))
            )
    })

    it('lay the cities’ own tiles on them (§10.4)', () => {
        expect(layableOn(MoscowLocationId)).toEqual(['637'])
        expect(layableOn('D14')).toEqual(['635'])
        expect(layableOn(StPetersburgLocationId)).toEqual(['641'])
        expect(layableOn('B4')).toEqual(['201', '202', '621'])
        expect(layableOn(KharkovLocationId)).toEqual(['201', '202', '621'])
    })

    it('charge R40 to upgrade Kiev’s green tile (§10.4)', () => {
        expect(Tiles1861.find((tile) => tile.printedNumber === '635')?.face.upgradeCost).toBe(40)
    })
})
