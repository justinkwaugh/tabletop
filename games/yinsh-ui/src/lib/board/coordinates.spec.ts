import { describe, expect, it } from 'vitest'
import { pointFromName, POINTS } from '@tabletop/yinsh'
import { pointCenter } from './geometry.js'
import { boardLabels } from './coordinates.js'

describe('boardLabels', () => {
    const labels = boardLabels(POINTS)

    it('letters each column and numbers each line, as BoardSpace does', () => {
        expect(labels.map((label) => label.text)).toEqual([
            ...'ABCDEFGHIJK'.split(''),
            ...['11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1']
        ])
    })

    it('puts each number up and to the left of the point its line starts at', () => {
        const two = labels.find((label) => label.text === '2')
        const a2 = pointCenter(pointFromName('A2'))
        expect(two?.at.x).toBeLessThan(a2.x)
        expect(two?.at.y).toBeLessThan(a2.y)
    })
})
