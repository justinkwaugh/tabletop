import { describe, expect, it } from 'vitest'
import { pointFromName as p, pointName } from '@tabletop/yinsh'
import { rowChoice, rowsThrough, type Row } from './rowChoice.js'

const row = (...names: string[]): Row => names.map(p)
const names = (list: ReturnType<typeof row>) => list.map(pointName)

// A run of seven, B3 to H3, holds three rows.
const RUN = [
    row('B3', 'C3', 'D3', 'E3', 'F3'),
    row('C3', 'D3', 'E3', 'F3', 'G3'),
    row('D3', 'E3', 'F3', 'G3', 'H3')
]

describe('rowChoice', () => {
    it('settles a lone row with any of its markers', () => {
        const choice = rowChoice([RUN[0]])
        expect(names(choice.settling)).toEqual(['B3', 'C3', 'D3', 'E3', 'F3'])
    })

    it('settles only the ends of a longer run until one end is chosen', () => {
        expect(names(rowChoice(RUN).settling)).toEqual(['B3', 'H3'])
        expect(names(rowChoice(RUN, p('C3')).settling)).toEqual(['B3', 'G3'])
    })

    it('reaches the middle row of seven through its two ends', () => {
        expect(rowsThrough(RUN, p('C3'), p('G3'))).toEqual([RUN[1]])
    })

    it('lets either of two crossing rows be chosen through their shared marker', () => {
        const crossing = [row('B4', 'C4', 'D4', 'E4', 'F4'), row('F4', 'G5', 'H6', 'I7', 'J8')]
        const free = rowChoice(crossing)
        expect(names(free.settling)).not.toContain('F4')
        expect(names(rowChoice(crossing, p('F4')).settling)).toHaveLength(8)
    })
})
