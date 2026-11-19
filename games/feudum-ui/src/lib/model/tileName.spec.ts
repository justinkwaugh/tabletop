import { RegionTiles } from '@tabletop/feudum'
import { describe, expect, it } from 'vitest'
import { tileName } from './tileName.js'

describe('tileName', () => {
    it('names every tile by region and epoch, never by its id', () => {
        expect(tileName('tile.sea.i')).toBe('Sea I')
        expect(tileName('tile.sea.iv')).toBe('Sea IV')
        const names = RegionTiles.map(({ id }) => tileName(id))
        expect(new Set(names).size).toBe(RegionTiles.length)
        expect(names.filter((name) => name.includes('.'))).toEqual([])
    })
})
