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

it('provides unlimited yellow tiles with finite straight and double-dit tiles, including labeled city curves', () => {
    expect(TheOldPrinceTiles).toHaveLength(62)
    const inventory = TheOldPrinceTileSet.createInventory()
    const counts = new Map(
        TheOldPrinceTileSet.counts(inventory).map((count) => [count.definitionId, count.total])
    )
    expect(['7', '8', '9'].map((number) => counts.get(`18xx:${number}`))).toEqual(['unlimited', 'unlimited', 1])
    expect(
        Array.from({ length: 16 }, (_, index) => counts.get(`the-old-prince:PEI${index + 1}`))
    ).toEqual([3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1])
    for (const tile of TheOldPrinceTiles.filter((tile) => tile.face.color === 'yellow')) {
        expect(counts.get(tile.id)).toBe(tile.id === '18xx:9' ? 1 : tile.face.nodes.filter((node) => node.kind === 'town').length === 2 ? 2 : 'unlimited')
    }
    for (const label of ['X', 'T']) {
        for (const number of ['5', '6']) {
            const tile = TheOldPrinceTiles.find((tile) => tile.id === `the-old-prince:${number}${label}`)
            expect(tile?.face.paths).toEqual(StandardTileCatalog.get(`18xx:${number}`).face.paths)
            expect(tile?.face.labels).toEqual([label])
            expect(tile?.face.nodes[0]).toMatchObject({ stationSlots: 1, revenue: { amount: 20 } })
        }
    }
    expect(TheOldPrincePreprintedTiles.I17.nodes[0]).toMatchObject({
        kind: 'city',
        stationSlots: 2,
        revenue: { amount: 10 }
    })
})
