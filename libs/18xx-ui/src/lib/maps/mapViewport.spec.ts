import { minimalTrackMap } from '@tabletop/18xx/testing'
import { expect, it } from 'vitest'
import { createMapDrawing, mapShareOfViewport, mapViewport } from './mapDrawing.js'

const scene = createMapDrawing(minimalTrackMap)
const { bounds } = scene

it('measures the share of the viewport the hexes span', () => {
    expect(mapShareOfViewport(scene, mapViewport(scene, 100))).toBe(1)
    const panelBeside = { ...bounds, x: bounds.x + bounds.width }
    expect(mapShareOfViewport(scene, mapViewport(scene, 100, undefined, [panelBeside]))).toBe(0.5)
    const panelInside = { ...bounds, width: bounds.width / 2 }
    expect(mapShareOfViewport(scene, mapViewport(scene, 100, undefined, [panelInside]))).toBe(1)
})

it('exceeds 1 where artwork crops the map', () => {
    const artwork = {
        imageUrl: 'board.jpg',
        width: bounds.width / 2,
        height: bounds.height,
        origin: { x: -bounds.x, y: -bounds.y },
        scale: 1
    }
    expect(mapShareOfViewport(scene, mapViewport(scene, 100, artwork))).toBe(2)
})
