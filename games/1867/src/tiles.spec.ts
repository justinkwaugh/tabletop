import { describe, expect, it } from 'vitest'
import { TileUpgrades, requiredLabels, sameLabels } from '@tabletop/18xx'
import { Map1867, MontrealLocationId, OttawaLocationId, TorontoLocationId } from './map.js'
import {
    OttawaGreyTileId,
    TileColorOrder1867,
    TileSet1867,
    Tiles1867,
    preservesStops1867
} from './tiles.js'

const count = (number: string) =>
    TileSet1867.pieces.filter((piece) =>
        piece.faceDefinitionIds.some((id) => id.split(':')[1] === number)
    ).length

const upgrades = new TileUpgrades({
    map: Map1867,
    tileSet: TileSet1867,
    colorOrder: TileColorOrder1867,
    preservesStops: preservesStops1867
})
const byNumber = (a: string, b: string) =>
    Number(a.replace('X', '1000')) - Number(b.replace('X', '1000')) || a.localeCompare(b)
const numbers = (ids: readonly string[]) => ids.map((id) => id.split(':')[1]).toSorted(byNumber)
const definitionId = (number: string) => {
    const tile = Tiles1867.find((candidate) => candidate.printedNumber === number)
    if (!tile) throw new Error(number)
    return tile.id
}

function layableOn(locationId: string): string[] {
    const location = Map1867.location(locationId)
    const printed = location.preprintedTile
    return Tiles1867.filter(
        (tile) =>
            TileColorOrder1867.indexOf(tile.face.color) ===
                TileColorOrder1867.indexOf(printed.color) + 1 &&
            sameLabels(
                requiredLabels(location, tile.face.color, TileColorOrder1867, printed.labels),
                tile.face.labels
            )
    ).map((tile) => tile.printedNumber)
}

// The 1867 tile manifest (§19.2) as track preservation reads it (§8.6), the rule its errata follow:
// #16 and #28 also take #70, #23 takes #47 and #25 does not (as on the 1861 manifest), #801 also
// takes Ottawa's X8, and Montreal's X4 takes X6 rather than X7.
const Upgrades: Readonly<Record<string, readonly string[]>> = {
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
    '16': ['43', '70'],
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
    '28': ['39', '43', '46', '70'],
    '29': ['39', '43', '45', '70'],
    '30': ['42', '70'],
    '31': ['41', '70'],
    '87': ['911'],
    '88': ['911'],
    '120': ['122'],
    '204': ['911'],
    '207': ['623', '801'],
    '208': ['623'],
    '619': ['63', '611'],
    '622': ['623'],
    '624': ['39'],
    '625': ['70'],
    '626': ['44'],
    '637': ['X6'],
    X1: ['X5'],
    X2: ['X5', 'X7'],
    X3: ['X6', 'X7'],
    X4: ['X5', 'X6'],
    '623': ['X8'],
    '122': ['124'],
    X5: ['639'],
    X6: ['639'],
    X7: ['639'],
    '39': [],
    '63': [],
    '70': [],
    '611': [],
    '801': ['X8'],
    '911': [],
    '124': [],
    '639': [],
    X8: []
}

describe('the tiles', () => {
    it('match the manifest’s counts, with plain yellow track unlimited (§8.6.1, §19.2)', () => {
        expect(['3', '4', '5', '6', '57', '58', '201', '202', '621'].map(count)).toEqual([
            2, 4, 2, 2, 2, 4, 3, 3, 2
        ])
        expect(
            ['14', '15', '23', '24', '25', '207', '63', '70', '611', '623', '911'].map(count)
        ).toEqual([2, 4, 5, 5, 4, 5, 3, 2, 3, 3, 3])
        expect(
            ['637', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', '639', 'X8', '120', '122', '124'].map(
                count
            )
        ).toEqual(Array(13).fill(1))
        expect(
            TileSet1867.manifest.entries
                .filter((entry) => entry.count === 'unlimited')
                .map(({ id }) => id)
        ).toEqual(['7', '8', '9'])
        expect(TileSet1867.manifest.entries).toHaveLength(68)
    })

    it('upgrade as the manifest shows (§19.2)', () => {
        for (const [number, next] of Object.entries(Upgrades))
            expect(numbers(upgrades.upgradesTo(definitionId(number))), number).toEqual(
                next.toSorted(byNumber)
            )
    })

    it('lay the cities’ own tiles on them (§8.6)', () => {
        expect(layableOn(MontrealLocationId)).toEqual(['637', 'X1', 'X2', 'X3', 'X4'])
        expect(layableOn(TorontoLocationId)).toEqual(['120'])
        expect(layableOn('E17')).toEqual(['201', '202', '621'])
        expect(layableOn(OttawaLocationId)).toEqual(['201', '202', '621'])
    })

    it('give Ottawa alone its grey O tile (§8.6)', () => {
        const ottawa = Map1867.location(OttawaLocationId)
        expect(requiredLabels(ottawa, 'gray', TileColorOrder1867, ['Y'])).toEqual(['O'])
        expect(requiredLabels(Map1867.location('E17'), 'gray', TileColorOrder1867, ['Y'])).toEqual([
            'Y'
        ])
        expect(Tiles1867.find((tile) => tile.id === OttawaGreyTileId)?.face.labels).toEqual(['O'])
    })
})
