import { describe, expect, it } from 'vitest'
import { createMapDrawing } from '@tabletop/18xx-ui'
import { MapView1880 } from './mapView.js'

describe('1880 map', () => {
    it('prints arrows on every off-board area and harbour, and on nothing else', () => {
        const { locations } = createMapDrawing(MapView1880.map, undefined, {
            layouts: MapView1880.layouts
        })
        const arrowed = locations.filter(({ drawing }) => drawing.paths.some((path) => path.spike))
        expect(arrowed.map(({ location }) => location.id).toSorted()).toEqual([
            'A15',
            'A3',
            'I1',
            'K1',
            'N16',
            'Q13',
            'Q15',
            'Q7'
        ])
        for (const { drawing } of arrowed)
            expect(drawing.paths.every((path) => path.spike)).toBe(true)
        const unmarked = locations.filter(({ drawing }) =>
            drawing.nodes.some((node) => node.unmarked)
        )
        expect(unmarked.map(({ location }) => location.id).toSorted()).toEqual(['N16', 'Q13'])
    })
})
