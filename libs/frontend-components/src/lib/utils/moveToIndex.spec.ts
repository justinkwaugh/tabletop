import { expect, it } from 'vitest'
import { moveToIndex } from './moveToIndex.js'

it('moves an item to an index, clamped to the list', () => {
    expect(moveToIndex(['map', 'market', 'sheet', 'tiles'], 'map', 2)).toEqual([
        'market',
        'sheet',
        'map',
        'tiles'
    ])
    expect(moveToIndex(['map', 'market', 'sheet'], 'sheet', -3)).toEqual(['sheet', 'map', 'market'])
    expect(moveToIndex(['map', 'market', 'sheet'], 'map', 9)).toEqual(['market', 'sheet', 'map'])
})
