import { describe, expect, it } from 'vitest'
import { edgeMarkers, mesabiMarkers } from './mapState.js'

describe('the edge markers', () => {
    it('mark each area for its companies until their token stands there', () => {
        const before = edgeMarkers({ edgeTokens: [] })
        expect(before).toContainEqual({ locationId: 'A2', kind: 'edge-area:GN' })
        expect(before).toContainEqual({ locationId: 'C20', kind: 'edge-area:SOO' })
        expect(before.some((marker) => marker.kind.endsWith(':CBQ'))).toBe(false)
        const after = edgeMarkers({ edgeTokens: ['GN'] })
        expect(after).toContainEqual({ locationId: 'A2', kind: 'edge-token:GN' })
        expect(after).toContainEqual({ locationId: 'B1', kind: 'edge-area:NP' })
        expect(after).toContainEqual({ locationId: 'B1', kind: 'edge-area:MILW' })
    })
})

describe('the Mesabi markers', () => {
    it('stand a token on the Range for each right held', () => {
        expect(mesabiMarkers({ mesabiRights: ['NP', 'GN'] })).toEqual([
            { locationId: 'A10', kind: 'mesabi:0:NP' },
            { locationId: 'A10', kind: 'mesabi:1:GN' }
        ])
    })
})
