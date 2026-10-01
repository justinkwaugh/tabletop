import { expect, it } from 'vitest'
import { StandardTileCatalog, parseTileDefinition } from '@tabletop/18xx'
import {
    EighteenThirtyTiles,
    EighteenThirtyTileSet,
    EighteenThirtyPreprintedTiles
} from './index.js'

it('selects 46 shared definitions with the 1830 counts', () => {
    expect(EighteenThirtyTiles).toHaveLength(46)
    expect(EighteenThirtyTileSet.pieces).toHaveLength(85)
    for (const tile of EighteenThirtyTiles) {
        expect(tile).toBe(StandardTileCatalog.get(tile.id))
        expect(parseTileDefinition(JSON.parse(JSON.stringify(tile)))).toEqual(tile)
    }
    const counts = new Map(
        EighteenThirtyTileSet.counts(EighteenThirtyTileSet.createInventory()).map((count) => [
            count.definitionId,
            count.total
        ])
    )
    expect(['8', '9', '57', '63'].map((number) => counts.get(`18xx:${number}`))).toEqual([
        8, 7, 4, 3
    ])
})

it('labels the two-city and Boston/Baltimore hexes and their upgrades', () => {
    expect(EighteenThirtyPreprintedTiles.E11.labels).toEqual(['OO'])
    expect(EighteenThirtyPreprintedTiles.E11.nodes.map((node) => node.id)).toEqual([
        'city-0',
        'city-1'
    ])
    expect(EighteenThirtyPreprintedTiles.G19.labels).toEqual(['NY'])
    expect(EighteenThirtyPreprintedTiles.E23.labels).toEqual(['B'])
    const labelled = (label: string) =>
        EighteenThirtyTiles.filter((tile) => tile.face.labels.includes(label)).map(
            (tile) => `${tile.printedNumber}:${tile.face.color}`
        )
    expect(labelled('OO')).toEqual([
        '59:green',
        '64:brown',
        '65:brown',
        '66:brown',
        '67:brown',
        '68:brown'
    ])
    expect(labelled('NY')).toEqual(['54:green', '62:brown'])
    expect(labelled('B')).toEqual(['53:green', '61:brown'])
})
