import { describe, expect, it } from 'vitest'
import {
    resolvePoliticsPileOrigin,
    settlePoliticsPileOrigin,
    type OriginElement,
    type PoliticsPileOriginHandle
} from './politicsPileOrigin.js'

function elementCentredAt(x: number, y: number, isConnected = true): OriginElement {
    const width = 66
    const height = 103
    const left = x - width / 2
    const top = y - height / 2
    return {
        isConnected,
        getBoundingClientRect: () => ({
            x: left,
            y: top,
            width,
            height,
            top,
            left,
            right: left + width,
            bottom: top + height,
            toJSON: () => ({})
        })
    }
}

describe('resolvePoliticsPileOrigin', () => {
    it('measures a connected element where it is now', () => {
        const handle: PoliticsPileOriginHandle = { element: elementCentredAt(300, 120) }

        expect(resolvePoliticsPileOrigin(handle)).toEqual({ x: 300, y: 120 })
    })

    it('reports nothing for a detached element with no settled point', () => {
        const handle: PoliticsPileOriginHandle = { element: elementCentredAt(300, 120, false) }

        expect(resolvePoliticsPileOrigin(handle)).toBeUndefined()
    })

    it('falls back to the settled point once the element has gone', () => {
        const handle: PoliticsPileOriginHandle = {
            element: elementCentredAt(300, 120, false),
            point: { x: 280, y: 118 }
        }

        expect(resolvePoliticsPileOrigin(handle)).toEqual({ x: 280, y: 118 })
    })

    it('returns a plain point handle as it is', () => {
        expect(resolvePoliticsPileOrigin({ point: { x: 40, y: 50 } })).toEqual({ x: 40, y: 50 })
    })
})

describe('settlePoliticsPileOrigin', () => {
    it('records the measured point and releases the element, keeping the same handle', () => {
        const handle: PoliticsPileOriginHandle = { element: elementCentredAt(300, 120) }

        const settled = settlePoliticsPileOrigin(handle)

        expect(settled).toEqual({ x: 300, y: 120 })
        expect(handle.point).toEqual({ x: 300, y: 120 })
        expect(handle.element).toBeUndefined()
        expect(resolvePoliticsPileOrigin(handle)).toEqual({ x: 300, y: 120 })
    })

    it('changes nothing when there is nothing to settle', () => {
        const element = elementCentredAt(300, 120, false)
        const handle: PoliticsPileOriginHandle = { element }

        expect(settlePoliticsPileOrigin(handle)).toBeUndefined()
        expect(handle).toEqual({ element })
    })
})
