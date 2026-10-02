import { expect, it } from 'vitest'
import { StandardTileCatalog, parseTileDefinition } from '@tabletop/18xx'
import { EighteenSeventeenTiles, EighteenSeventeenTileSet } from './index.js'

it('selects 24 shared tiles and the X00 and X30 title tiles', () => {
    expect(EighteenSeventeenTiles).toHaveLength(26)
    for (const tile of EighteenSeventeenTiles) {
        if (tile.id.startsWith('18xx:')) expect(tile).toBe(StandardTileCatalog.get(tile.id))
        expect(parseTileDefinition(JSON.parse(JSON.stringify(tile)))).toEqual(tile)
    }
    const totals = new Map(
        EighteenSeventeenTileSet.counts(EighteenSeventeenTileSet.createInventory()).map((count) => [
            count.definitionId,
            count.total
        ])
    )
    expect(totals.get('1817:X00')).toBe(1)
    expect(totals.get('18xx:57')).toBe('unlimited')
})

it('labels the B and NY upgrades', () => {
    const labelled = (label: string) =>
        EighteenSeventeenTiles.filter((tile) => tile.face.labels.includes(label)).map(
            (tile) => `${tile.printedNumber}:${tile.face.color}`
        )
    expect(labelled('B')).toEqual(['592:green', '593:brown', '597:gray', 'X00:yellow'])
    expect(labelled('NY')).toEqual(['54:green', '62:brown', 'X30:gray'])
})
