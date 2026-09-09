import { expect, it } from 'vitest'
import { StandardTileCatalog, parseTileDefinition } from '@tabletop/18xx'
import { TheOldPrinceTiles, TheOldPrinceTileSet, TheOldPrincePreprintedTiles } from './index.js'

it('references shared numbered definitions and preserves PEI1 economic identity', () => {
    for (const number of ['7', '8', '9']) {
        expect(TheOldPrinceTiles.find((tile) => tile.printedNumber === number)).toBe(
            StandardTileCatalog.get(`18xx:${number}`)
        )
    }
    const pei1 = TheOldPrinceTiles.find((tile) => tile.printedNumber === 'PEI1')
    expect(pei1?.face.paths).toEqual(StandardTileCatalog.get('18xx:14').face.paths)
    expect(pei1?.face.nodes[0]).toMatchObject({
        stationSlots: 2,
        revenue: { kind: 'fixed', amount: 20 }
    })
    expect(StandardTileCatalog.get('18xx:14').face.nodes[0]).toMatchObject({
        revenue: { kind: 'fixed', amount: 30 }
    })
    for (const tile of TheOldPrinceTiles) {
        expect(parseTileDefinition(JSON.parse(JSON.stringify(tile)))).toEqual(tile)
    }
})

it('provides all 58 definitions and 164 finite pieces, including every PEI special', () => {
    expect(TheOldPrinceTiles).toHaveLength(58)
    expect(TheOldPrinceTileSet.pieces).toHaveLength(164)
    const inventory = TheOldPrinceTileSet.createInventory()
    const counts = new Map(
        TheOldPrinceTileSet.counts(inventory).map((count) => [count.definitionId, count.total])
    )
    expect(['7', '8', '9'].map((number) => counts.get(`18xx:${number}`))).toEqual([12, 25, 1])
    expect(
        Array.from({ length: 16 }, (_, index) => counts.get(`the-old-prince:PEI${index + 1}`))
    ).toEqual([3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1])
    expect(TheOldPrincePreprintedTiles.I17.nodes[0]).toMatchObject({
        kind: 'city',
        stationSlots: 2,
        revenue: { amount: 10 }
    })
})
