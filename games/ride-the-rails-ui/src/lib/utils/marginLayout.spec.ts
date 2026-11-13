import { describe, expect, it } from 'vitest'
import { MAP_IDS, RAILROAD_INTRODUCTIONS } from '@tabletop/ride-the-rails'
import { MARGIN_BOXES } from './boardGeometry.js'
import { stripLocomotivePoint, turnOrderMarkerPoint } from './marginLayout.js'

function inside(
    box: { x: number; y: number; width: number; height: number },
    point: { x: number; y: number }
) {
    return (
        point.x > box.x &&
        point.x < box.x + box.width &&
        point.y > box.y &&
        point.y < box.y + box.height
    )
}

describe('the margin layout the flights travel to (R-1.4)', () => {
    it('puts every strip locomotive inside the railroad strip, one row each', () => {
        for (const mapId of MAP_IDS) {
            const points = RAILROAD_INTRODUCTIONS[mapId].map(({ railroadId }) =>
                stripLocomotivePoint(mapId, railroadId)
            )
            expect(points.every((point) => inside(MARGIN_BOXES.railroadStrip, point))).toBe(true)
            expect(new Set(points.map((point) => point.y)).size).toBe(points.length)
        }
    })

    it('puts every seat marker inside the turn-order track, in turn order', () => {
        const turnOrder = ['p1', 'p2', 'p3', 'p4', 'p5']
        const points = turnOrder.map((playerId) => turnOrderMarkerPoint(turnOrder, playerId))
        expect(points.every((point) => inside(MARGIN_BOXES.turnOrder, point))).toBe(true)
        expect(points.map((point) => point.x)).toEqual(
            [...points.map((point) => point.x)].sort((a, b) => a - b)
        )
    })
})
