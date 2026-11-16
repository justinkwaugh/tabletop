import { describe, expect, it } from 'vitest'
import { StandardTileCatalog, parseTileDefinition } from '@tabletop/18xx'
import { TileCatalog1856, TileSet1856, preservesStops1856 } from './tiles.js'

const face = (definitionId: string) => {
    const definition = TileSet1856.definitions.find((tile) => tile.id === definitionId)
    if (!definition) throw new Error(`No tile ${definitionId}`)
    return definition.face
}

describe('the 1856 tiles', () => {
    it('holds the tile list: 55 yellow, 31 green, 34 brown and 2 gray', () => {
        const byColor = new Map<string, number>()
        for (const piece of TileSet1856.pieces) {
            const [definitionId] = piece.faceDefinitionIds
            if (!definitionId) throw new Error(`Piece ${piece.id} has no face`)
            const color = face(definitionId).color
            byColor.set(color, (byColor.get(color) ?? 0) + 1)
        }
        expect(Object.fromEntries(byColor)).toEqual({ yellow: 55, green: 31, brown: 34, gray: 2 })
        expect(TileSet1856.pieces).toHaveLength(122)
    })

    it('counts the tiles the list prints more than once', () => {
        const counts = new Map(
            TileSet1856.counts(TileSet1856.createInventory()).map((count) => [
                count.definitionId,
                count.total
            ])
        )
        expect(
            ['3', '7', '8', '9', '57', '58', '14', '23', '59', '41', '63'].map((number) =>
                counts.get(`18xx:${number}`)
            )
        ).toEqual([3, 7, 13, 13, 4, 3, 4, 4, 2, 3, 4])
        expect(['121', '125'].map((number) => counts.get(`1856:${number}`))).toEqual([2, 4])
    })

    it('shares the standard definitions and adds tiles 120 to 127', () => {
        for (const tile of TileSet1856.definitions) {
            if (tile.scope === '1856') expect(TileCatalog1856.get(tile.id)).toBe(tile)
            else expect(tile).toBe(StandardTileCatalog.get(tile.id))
            expect(parseTileDefinition(JSON.parse(JSON.stringify(tile)))).toEqual(tile)
        }
        expect(TileCatalog1856.entries().map((tile) => tile.printedNumber)).toEqual([
            '120',
            '121',
            '122',
            '123',
            '124',
            '125',
            '126',
            '127'
        ])
    })

    it('labels Toronto’s, London and Barrie’s, Hamilton’s and the L hexes’ tiles', () => {
        const labelled = (label: string) =>
            TileSet1856.definitions
                .filter((tile) => tile.face.labels.includes(label))
                .map((tile) => `${tile.printedNumber}:${tile.face.color}`)
        expect(labelled('T')).toEqual(['120:green', '122:brown', '124:gray'])
        expect(labelled('B-L')).toEqual(['121:green'])
        expect(labelled('Lon')).toEqual(['126:brown'])
        expect(labelled('Bar')).toEqual(['127:brown'])
        expect(labelled('H')).toEqual(['123:gray'])
        expect(labelled('L')).toEqual(['125:brown'])
        expect(labelled('OO')).toEqual([
            '59:green',
            '64:brown',
            '65:brown',
            '66:brown',
            '67:brown',
            '68:brown'
        ])
    })

    it('prints the title tiles’ values, stations and exits', () => {
        const summary = (number: string) => {
            const tile = face(`1856:${number}`)
            return tile.nodes.map((node) =>
                node.kind === 'city' && node.revenue.kind === 'fixed'
                    ? `${node.revenue.amount}x${node.stationSlots}`
                    : node.kind
            )
        }
        expect(summary('120')).toEqual(['60x1', '60x1'])
        expect(summary('121')).toEqual(['50x2'])
        expect(summary('122')).toEqual(['80x2', '80x2'])
        expect(summary('123')).toEqual(['60x3'])
        expect(summary('124')).toEqual(['100x4'])
        expect(summary('125')).toEqual(['40x2'])
        expect(summary('126')).toEqual(['60x2'])
        expect(summary('127')).toEqual(['60x2'])
        expect(face('1856:125').paths).toHaveLength(5)
        expect(face('1856:126').paths).toHaveLength(6)
    })

    it('lets Toronto’s and Hamilton’s two cities join in gray and keeps every other upgrade’s stops', () => {
        expect(preservesStops1856(face('1856:122'), face('1856:124'))).toBe(true)
        expect(preservesStops1856(face('18xx:64'), face('1856:123'))).toBe(true)
        expect(preservesStops1856(face('18xx:14'), face('18xx:63'))).toBe(true)
        expect(preservesStops1856(face('18xx:1'), face('18xx:14'))).toBe(false)
        expect(preservesStops1856(face('18xx:59'), face('18xx:63'))).toBe(false)
    })
})
