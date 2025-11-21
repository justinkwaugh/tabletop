import { describe, expect, it } from 'vitest'
import { HydratedTileBag, TileBag } from './tileBag.js'
import { TileType } from './tiles.js'

describe('TileBag Tests', () => {
    it('hydrates correctly', () => {
        const tileData: TileBag = {
            items: [{ type: TileType.Market }, { type: TileType.Market }],
            remaining: 2
        }
        const tileBag = new HydratedTileBag(tileData)

        const dehydrated = tileBag.dehydrate()
        expect(dehydrated).toEqual(tileData)
    })
})
