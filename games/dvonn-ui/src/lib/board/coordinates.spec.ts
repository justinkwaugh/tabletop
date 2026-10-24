import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { spaceFromName, SPACES } from '@tabletop/dvonn'
import { LAYOUT } from './geometry.js'
import { boardLabels } from './coordinates.js'

describe('boardLabels', () => {
    const spaceCenter = (coords: AxialCoordinates) => LAYOUT.center(coords)
    const labels = boardLabels(SPACES, spaceCenter)

    it('letters each diagonal column and numbers each row, as BoardSpace does', () => {
        expect(labels.map((label) => label.text)).toEqual([
            ...'ABCDEFGHIJK'.split(''),
            ...['5', '4', '3', '2', '1']
        ])
    })

    it('puts each number level with and left of the space its row starts at', () => {
        const two = labels.find((label) => label.text === '2')
        const a2 = spaceCenter(spaceFromName('A2'))
        expect(two?.at.x).toBeLessThan(a2.x)
        expect(two?.at.y).toBeCloseTo(a2.y)
    })

    it('puts each letter below its column’s bottom space', () => {
        const k = labels.find((label) => label.text === 'K')
        const k3 = spaceCenter(spaceFromName('K3'))
        expect(k?.at.y).toBeGreaterThan(k3.y)
    })
})
