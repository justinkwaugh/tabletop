import { describe, expect, it } from 'vitest'
import {
    StandardTileCatalog,
    TileEdges,
    parseTileDefinition,
    rotateTileEdge,
    type TileFace
} from '@tabletop/18xx'
import {
    EighteenUSATiles,
    EighteenUSATileSet,
    MetropolisCandidates,
    NewYorkId,
    EighteenUSAMap
} from './index.js'

const tile = (printedNumber: string) => {
    const found = EighteenUSATiles.find((entry) => entry.printedNumber === printedNumber)
    if (!found) throw new Error(`No tile ${printedNumber}`)
    return found
}
const totals = new Map(
    EighteenUSATileSet.counts(EighteenUSATileSet.createInventory()).map((count) => [
        count.definitionId,
        count.total
    ])
)
const edges = (face: TileFace) =>
    new Set(
        face.paths.flatMap((path) =>
            path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
        )
    )
/** Whether some rotation of the next face keeps every track exit of the face before it. */
const keepsExits = (before: TileFace, after: TileFace) =>
    TileEdges.some((rotation) => {
        const rotated = new Set([...edges(after)].map((edge) => rotateTileEdge(edge, rotation)))
        return [...edges(before)].every((edge) => rotated.has(edge))
    })

describe('the 18USA tiles', () => {
    it('holds the rulebook manifest', () => {
        expect(EighteenUSATiles.map((entry) => entry.printedNumber).sort()).toEqual(
            [
                ...['5', '6', '7', '8', '9', '57', 'X01', 'X02', 'X03', 'X04', 'X05', 'X06'],
                ...['X07', 'X08', 'X09', '14', '15', '80', '81', '82', '83', '619', 'X10'],
                ...['X11', 'X12', '592', '63', '448', '544', '545', '546', '611', 'X13'],
                ...['X14', 'X15', 'X16', '593', '60', '597', 'X17', 'X18', 'X19', 'X20'],
                ...['X21', 'X22', 'X23', 'X30']
            ].sort()
        )
        for (const entry of EighteenUSATiles) {
            if (entry.id.startsWith('18xx:')) expect(entry).toBe(StandardTileCatalog.get(entry.id))
            expect(parseTileDefinition(JSON.parse(JSON.stringify(entry)))).toEqual(entry)
        }
    })

    it('keeps plain tiles unlimited and the special tiles to their printed counts', () => {
        for (const id of ['18xx:7', '18xx:57', '18xx:619', '18xx:611', '18usa:60', '18usa:X17'])
            expect(totals.get(id), id).toBe('unlimited')
        for (const id of ['18xx:592', '18xx:593', '18xx:597']) expect(totals.get(id), id).toBe(4)
        for (const number of ['X01', 'X07', 'X12', 'X13', 'X20', 'X23', 'X30'])
            expect(totals.get(`18usa:${number}`), number).toBe(1)
    })

    it('colours the special tiles', () => {
        const colorOf = (numbers: readonly string[]) => [
            ...new Set(numbers.map((number) => tile(number).face.color))
        ]
        expect(colorOf(['X01', 'X02', 'X03', 'X04', 'X05', 'X06', 'X07', 'X08', 'X09'])).toEqual([
            'yellow'
        ])
        expect(colorOf(['X10', 'X11', 'X12'])).toEqual(['green'])
        expect(colorOf(['X13', 'X14', 'X15', 'X16'])).toEqual(['brown'])
        expect(colorOf(['X17', 'X18', 'X19', 'X20', 'X21', 'X22', 'X23', 'X30', '60'])).toEqual([
            'gray'
        ])
    })

    it('upgrades every metropolis along its label, keeping its exits', () => {
        const chain = (label: string) =>
            ['green', 'brown', 'gray'].map((color) => {
                const matching = EighteenUSATiles.filter(
                    (entry) => entry.face.color === color && entry.face.labels.includes(label)
                )
                expect(matching, `${label} ${color}`).toHaveLength(1)
                return matching[0].face
            })
        for (const metropolis of MetropolisCandidates) {
            const yellow = EighteenUSATiles.find((entry) => entry.id === metropolis.yellowTileId)
            if (!yellow) throw new Error(metropolis.yellowTileId)
            expect(yellow.face).toMatchObject({
                color: 'yellow',
                nodes: [{ revenue: { amount: 30 } }]
            })
            const faces = [yellow.face, ...chain(metropolis.upgradeLabel)]
            for (let index = 1; index < faces.length; index++)
                expect(keepsExits(faces[index - 1], faces[index]), metropolis.locationId).toBe(true)
        }
    })

    it('upgrades New York from its printed tile to X30', () => {
        const map = EighteenUSAMap
        const faces = [
            map.location(NewYorkId).preprintedTile,
            tile('X12').face,
            tile('X16').face,
            tile('X30').face
        ]
        expect(faces.map((face) => face.labels)).toEqual([['NY'], ['NY'], ['NY'], ['NY']])
        for (let index = 1; index < faces.length; index++)
            expect(keepsExits(faces[index - 1], faces[index])).toBe(true)
    })

    it('upgrades Cleveland to X13 only from tile 15', () => {
        expect(tile('X13').face.labels).toEqual(['CLE'])
        expect(
            ['14', '15', '619'].map((number) => keepsExits(tile(number).face, tile('X13').face))
        ).toEqual([false, true, false])
    })

    it('makes rural junctions uncounted stops without stations', () => {
        for (const number of ['X07', 'X08', 'X09'])
            expect(tile(number).face.nodes).toEqual([
                {
                    id: 'city',
                    kind: 'city',
                    revenue: { kind: 'fixed', amount: 10 },
                    stationSlots: 0,
                    uncounted: true
                }
            ])
    })

    it('values the company towns by the colour of track available', () => {
        for (const number of ['X20', 'X21', 'X22'])
            expect(tile(number).face.nodes).toMatchObject([
                {
                    stationSlots: 1,
                    revenue: {
                        kind: 'staged',
                        values: [
                            { stage: 'yellow', amount: 30 },
                            { stage: 'green', amount: 40 },
                            { stage: 'brown', amount: 50 }
                        ]
                    }
                }
            ])
    })
})
