import { expect, it } from 'vitest'
import { StandardTileCatalog, parseTileDefinition } from '@tabletop/18xx'
import { Shikoku1889TileSpecimens } from './index.js'

it('selects shared definitions, including the unlabeled standard 611', () => {
    for (const number of ['7', '8', '9', '611']) {
        expect(Shikoku1889TileSpecimens.find((tile) => tile.printedNumber === number)).toBe(
            StandardTileCatalog.get(`18xx:${number}`)
        )
    }
    expect(
        Shikoku1889TileSpecimens.find((tile) => tile.printedNumber === '611')?.face.labels
    ).toEqual([])
    for (const tile of Shikoku1889TileSpecimens) {
        expect(parseTileDefinition(JSON.parse(JSON.stringify(tile)))).toEqual(tile)
    }
})
