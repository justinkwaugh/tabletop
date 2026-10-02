import { describe, expect, test } from 'vitest'
import { Cobbles, CobbleTileSize } from './cobbles.js'

describe('Cobbles', () => {
    test('covers the tile with stones that stay near it', () => {
        const coordinates = Cobbles.flatMap((cobble) =>
            [...cobble.path.matchAll(/-?\d+\.\d/g)].map((match) => Number(match[0]))
        )
        expect(Cobbles.length).toBeGreaterThan(157)
        expect(Math.min(...coordinates)).toBeGreaterThan(-CobbleTileSize / 4)
        expect(Math.max(...coordinates)).toBeLessThan(CobbleTileSize * 1.25)
    })
})
