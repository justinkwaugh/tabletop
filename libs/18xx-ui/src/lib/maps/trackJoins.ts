import { assertExists } from '@tabletop/common'
import type { MapDrawing } from './mapDrawing.js'

export function mapTrackJoins(scene: MapDrawing) {
    const endpoints = scene.locations.flatMap((entry) => entry.face.paths.flatMap((path) => {
        const drawing = entry.drawing.paths.find((candidate) => candidate.id === path.id)
        assertExists(drawing, `Missing drawn track ${path.id}`)
        return path.endpoints.flatMap((endpoint, index) => {
            if (endpoint.kind !== 'edge') return []
            const point = index === 0 ? drawing.start : drawing.end
            return [{ locationId: entry.location.id, x: entry.center.x + point.x, y: entry.center.y + point.y,
                angle: Math.atan2(point.y, point.x) * 180 / Math.PI }]
        })
    }))
    return endpoints.filter((point, index) => endpoints.some((other, otherIndex) =>
        otherIndex < index && other.locationId !== point.locationId &&
        Math.hypot(point.x - other.x, point.y - other.y) < 0.01
    ))
}
