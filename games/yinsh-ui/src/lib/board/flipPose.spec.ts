import { describe, expect, it } from 'vitest'
import { flipPose } from './flipPose.js'
import { VIEW } from './geometry.js'

const pose = (degrees: number, travel = { x: 0, y: -1 }) =>
    flipPose(VIEW, {
        radius: 18,
        height: 6.6,
        travel,
        turn: (degrees * Math.PI) / 180,
        hop: 5
    })

// The face's height on screen, from its matrix's y terms.
function faceHeight(degrees: number, travel?: { x: number; y: number }): number {
    const [, b, , d] = pose(degrees, travel).face.slice(7, -1).split(' ').map(Number)
    return 18 * Math.hypot(b, d)
}

describe('flipPose', () => {
    it('starts and ends lying flat, foreshortened by the tilt', () => {
        expect(faceHeight(0)).toBeCloseTo(18 * VIEW.tilt)
        expect(faceHeight(180)).toBeCloseTo(18 * VIEW.tilt)
        expect(pose(0).upperFace).toBe(true)
        expect(pose(180).upperFace).toBe(false)
    })

    it('turning away from the viewer, goes edge-on before standing up', () => {
        const edgeOn = (Math.atan(VIEW.tilt / VIEW.rise) * 180) / Math.PI
        expect(faceHeight(edgeOn)).toBeCloseTo(0)
        expect(pose(edgeOn - 1).upperFace).toBe(true)
        expect(pose(edgeOn + 1).upperFace).toBe(false)
    })

    it('turning toward the viewer, shows the old face standing up', () => {
        expect(pose(90, { x: 0, y: 1 }).upperFace).toBe(true)
        expect(faceHeight(90, { x: 0, y: 1 })).toBeCloseTo(18 * VIEW.rise)
    })
})
