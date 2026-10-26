import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { spaceFromName } from '@tabletop/dvonn'
import { VIEW } from './geometry.js'

describe('boardLabels', () => {
    const spaceCenter = (coords: AxialCoordinates) => VIEW.center(coords)
    const labels = VIEW.labels

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

    it('keeps the letters along the bottom in line, and each number as far from its row', () => {
        const at = (text: string) => labels.find((label) => label.text === text)?.at
        const bottom = 'ABCDEFGHI'.split('').map((text) => at(text)?.y ?? NaN)
        const before = ['A1', 'A2', 'A3', 'B4', 'C5'].map(
            (name) => spaceCenter(spaceFromName(name)).x - (at(name.slice(1))?.x ?? NaN)
        )
        for (const y of bottom) expect(y).toBeCloseTo(bottom[0])
        for (const distance of before) expect(distance).toBeCloseTo(before[0])
    })
})
