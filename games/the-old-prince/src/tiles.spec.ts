import { expect, it } from 'vitest'
import { StandardTileCatalog, parseTileDefinition } from '@tabletop/18xx'
import { TheOldPrinceTileSpecimens } from './index.js'

it('references shared numbered definitions and preserves PEI1 economic identity', () => {
    for (const number of ['7', '8', '9']) {
        expect(TheOldPrinceTileSpecimens.find((tile) => tile.printedNumber === number)).toBe(
            StandardTileCatalog.get(`18xx:${number}`)
        )
    }
    const pei1 = TheOldPrinceTileSpecimens.find((tile) => tile.printedNumber === 'PEI1')
    expect(pei1?.face.paths).toEqual(StandardTileCatalog.get('18xx:14').face.paths)
    expect(pei1?.face.nodes[0]).toMatchObject({
        stationSlots: 2,
        revenue: { kind: 'fixed', amount: 20 }
    })
    expect(StandardTileCatalog.get('18xx:14').face.nodes[0]).toMatchObject({
        revenue: { kind: 'fixed', amount: 30 }
    })
    for (const tile of TheOldPrinceTileSpecimens) {
        expect(parseTileDefinition(JSON.parse(JSON.stringify(tile)))).toEqual(tile)
    }
})
