import { expect, it } from 'vitest'
import { tileGroupOf, withTileGroups } from './tileGroups.js'

const view = { tileGroups: [['D12', 'E13', 'F12']] }

it('finds the hexes one tile covers, and adds them to a set of hexes', () => {
    expect(tileGroupOf(view, 'E13')).toEqual(['D12', 'E13', 'F12'])
    expect(tileGroupOf(view, 'C11')).toBeUndefined()
    expect(withTileGroups(view, ['C11', 'F12'])).toEqual(['C11', 'D12', 'E13', 'F12'])
    expect(withTileGroups({}, ['C11'])).toEqual(['C11'])
})
