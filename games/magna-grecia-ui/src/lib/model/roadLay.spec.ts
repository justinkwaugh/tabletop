import { describe, expect, it } from 'vitest'
import { PointyHexDirection } from '@tabletop/common'
import { RoadShape, type RoadEnds } from '@tabletop/magna-grecia'
import { roadPlacement, legalRoadShapeChoices } from './roadLay.js'

const { East: E, West: W, Northwest: NW, Southeast: SE } = PointyHexDirection

describe('road laying choices', () => {
    const straight: RoadEnds = [W, E]
    const curveA: RoadEnds = [E, NW]
    const curveB: RoadEnds = [SE, W]

    it('groups legal road ends into straight then curved tiles', () => {
        const choices = legalRoadShapeChoices([curveA, straight, curveB])
        expect(choices.map((choice) => choice.shape)).toEqual([RoadShape.Straight, RoadShape.Curve])
        expect(choices[1].placements).toEqual([curveA, curveB])
    })

    it('omits a tile shape with no legal orientation', () => {
        expect(legalRoadShapeChoices([straight]).map((choice) => choice.shape)).toEqual([
            RoadShape.Straight
        ])
    })

    it('cycles through a shape’s legal orientations', () => {
        const placements = [curveA, curveB]
        expect(roadPlacement(placements, 0)).toEqual(curveA)
        expect(roadPlacement(placements, 1)).toEqual(curveB)
        expect(roadPlacement(placements, 2)).toEqual(curveA)
        expect(roadPlacement([], 0)).toBeUndefined()
    })
})
