import { beforeAll, describe, expect, it } from 'vitest'
import { docTableRows, readDoc } from '../testing/docs.js'
import {
    EpochLandscapes,
    LandscapeFill,
    LandscapeKinds,
    Landscapes,
    ProgressDieFaces,
    RegionIds,
    RegionTiles,
    TileEpochs,
    type LandscapeKind
} from './regionTiles.js'
import { RegionTileChart } from './tracks.js'

let components = ''

beforeAll(async () => {
    components = await readDoc('components.md')
})

describe('R-4.3.1 the 24 stack positions', () => {
    it('match the rows of components.md: id, region and epoch', () => {
        expect(RegionTiles.map((tile) => [tile.id, tile.region, tile.epoch])).toEqual(
            docTableRows(components, '## Region tiles (24)').map((row) => [
                row['Id'],
                row['Region'],
                ['I', 'II', 'III', 'IV'].indexOf(row['Epoch (front)']) + 1
            ])
        )
    })

    it('24 positions, 6 per epoch and 4 per region, each id once', () => {
        expect(RegionTiles).toHaveLength(24)
        expect(new Set(RegionTiles.map((tile) => tile.id)).size).toBe(24)
        for (const epoch of TileEpochs) {
            expect(RegionTiles.filter((tile) => tile.epoch === epoch)).toHaveLength(6)
        }
        for (const region of RegionIds) {
            expect(RegionTiles.filter((tile) => tile.region === region)).toHaveLength(4)
        }
    })

    it('each region lists its stack top first: I on top, IV at the bottom', () => {
        for (const region of RegionIds) {
            expect(
                RegionTiles.filter((tile) => tile.region === region).map((tile) => tile.id)
            ).toEqual([
                `tile.${region}.i`,
                `tile.${region}.ii`,
                `tile.${region}.iii`,
                `tile.${region}.iv`
            ])
        }
    })

    it('R-4.3.2 the printed score of a legal tile is the chart row of its epoch', () => {
        const rows = docTableRows(components, '## Region tiles (24)')
        RegionTiles.forEach((tile, index) => {
            const chart = RegionTileChart.find((row) => row.tileEpoch === tile.epoch)
            expect(rows[index]['Score when taken (legal)']).toBe(
                `farm ${chart?.vp?.farm} / town ${chart?.vp?.town} / feudum ${chart?.vp?.feudum}`
            )
        })
    })
})

describe('R-4.3.4 the landscapes', () => {
    it('four kinds, each with its resource', () => {
        expect(Landscapes.map((landscape) => [landscape.kind, landscape.resource])).toEqual([
            ['orchard', 'food'],
            ['silver-mine', 'shillings'],
            ['archery-butt', 'targets'],
            ['sulfur-mine', 'sulfur']
        ])
        expect(Landscapes.map((landscape) => landscape.kind)).toEqual(LandscapeKinds)
    })

    it('3 of the resource are added when placed and at each dawn', () => {
        expect(LandscapeFill).toBe(3)
    })
})

describe('R-1.4-H2 each epoch prints six landscapes, not one per stack position', () => {
    function amount(epoch: keyof typeof EpochLandscapes, kind: LandscapeKind): number {
        return EpochLandscapes[epoch].filter((landscape) => landscape === kind).length
    }

    it('the mix matches components.md', () => {
        const columns: Record<LandscapeKind, string> = {
            orchard: 'Orchard',
            'silver-mine': 'Silver mine',
            'sulfur-mine': 'Sulfur deposit',
            'archery-butt': 'Archery butt'
        }
        const rows = docTableRows(components, '### Landscapes per epoch (24)')
        for (const epoch of TileEpochs) {
            const row = rows[epoch - 1]
            expect(row['Epoch']).toBe(['I', 'II', 'III', 'IV'][epoch - 1])
            for (const kind of LandscapeKinds) {
                expect(amount(epoch, kind)).toBe(Number(row[columns[kind]]))
            }
        }
    })

    it('orchard, silver mine, sulfur mine, archery butt: I 2/2/1/1, II 1/1/2/2, III 2/2/1/1, IV 1/1/2/2', () => {
        const mix = (epoch: keyof typeof EpochLandscapes) =>
            (['orchard', 'silver-mine', 'sulfur-mine', 'archery-butt'] as const).map((kind) =>
                amount(epoch, kind)
            )
        expect(mix(1)).toEqual([2, 2, 1, 1])
        expect(mix(2)).toEqual([1, 1, 2, 2])
        expect(mix(3)).toEqual([2, 2, 1, 1])
        expect(mix(4)).toEqual([1, 1, 2, 2])
    })

    it('six per epoch, one for each stack, and 6 of each kind in all', () => {
        for (const epoch of TileEpochs) {
            expect(EpochLandscapes[epoch]).toHaveLength(RegionIds.length)
        }
        const all = TileEpochs.flatMap((epoch) => EpochLandscapes[epoch])
        expect(all).toHaveLength(RegionTiles.length)
        for (const kind of LandscapeKinds) {
            expect(all.filter((landscape) => landscape === kind)).toHaveLength(6)
        }
    })

    it('a stack position carries no landscape of its own', () => {
        for (const tile of RegionTiles) {
            expect(Object.keys(tile).sort()).toEqual(['epoch', 'id', 'region'])
        }
    })
})

describe('R-4.11.1 the progress die', () => {
    it('six faces, each naming a region once', () => {
        expect(ProgressDieFaces).toHaveLength(6)
        expect([...ProgressDieFaces].sort()).toEqual([...RegionIds].sort())
    })

    it('components.md gives each region its die face', () => {
        const rows = docTableRows(components, '## Regions (6)')
        expect(rows.map((row) => row['Name'])).toEqual([...RegionIds])
        for (const row of rows) {
            expect(row['Id']).toBe(`region.${row['Name']}`)
            expect(row['Progress die face']).toContain(`the ${row['Name']} icon`)
        }
    })
})
