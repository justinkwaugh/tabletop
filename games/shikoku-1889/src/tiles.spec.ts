import { expect, it } from 'vitest'
import { StandardTileCatalog, parseTileDefinition } from '@tabletop/18xx'
import {
    Shikoku1889Tiles,
    Shikoku1889TileSet,
    Shikoku1889BeginnerTileSet,
    Shikoku1889PreprintedTiles
} from './index.js'

it('selects shared definitions, including the unlabeled standard 611', () => {
    for (const number of ['7', '8', '9', '611']) {
        expect(Shikoku1889Tiles.find((tile) => tile.printedNumber === number)).toBe(
            StandardTileCatalog.get(`18xx:${number}`)
        )
    }
    expect(Shikoku1889Tiles.find((tile) => tile.printedNumber === '611')?.face.labels).toEqual([])
    for (const tile of Shikoku1889Tiles) {
        expect(parseTileDefinition(JSON.parse(JSON.stringify(tile)))).toEqual(tile)
    }
})

it('provides 63 standard pieces and the eight additional beginner pieces', () => {
    expect(Shikoku1889Tiles).toHaveLength(40)
    expect(Shikoku1889TileSet.pieces).toHaveLength(63)
    expect(Shikoku1889BeginnerTileSet.pieces).toHaveLength(71)
    const standard = new Map(
        Shikoku1889TileSet.counts(Shikoku1889TileSet.createInventory()).map((count) => [
            count.definitionId,
            count.total
        ])
    )
    const beginner = new Map(
        Shikoku1889BeginnerTileSet.counts(Shikoku1889BeginnerTileSet.createInventory()).map(
            (count) => [count.definitionId, count.total]
        )
    )
    expect(['7', '8', '9'].map((number) => standard.get(`18xx:${number}`))).toEqual([2, 5, 5])
    expect(
        ['6', '7', '8', '9', '23', '24', '57'].map(
            (number) => beginner.get(`18xx:${number}`)! - standard.get(`18xx:${number}`)!
        )
    ).toEqual([2, 1, 1, 1, 1, 1, 1])
    expect(Shikoku1889PreprintedTiles.F9.labels).toEqual(['K'])
    expect(Shikoku1889Tiles.find((tile) => tile.printedNumber === '437')?.face.symbols).toEqual([
        'port'
    ])
    expect(
        ['438', '439', '492'].map(
            (number) =>
                Shikoku1889Tiles.find((tile) => tile.printedNumber === number)?.face.upgradeCost
        )
    ).toEqual([80, 80, undefined])
})
