import { RoadShape, roadShape, type RoadEnds } from '@tabletop/magna-grecia'

export type RoadShapeChoice = { shape: RoadShape; placements: RoadEnds[] }

const SHAPE_ORDER = [RoadShape.Straight, RoadShape.Curve]

export function legalRoadShapeChoices(options: RoadEnds[]): RoadShapeChoice[] {
    return SHAPE_ORDER.map((shape) => ({
        shape,
        placements: options.filter((ends) => roadShape(ends) === shape)
    })).filter((choice) => choice.placements.length > 0)
}

export function roadPlacement(placements: RoadEnds[], rotation: number): RoadEnds | undefined {
    if (placements.length === 0) {
        return undefined
    }
    return placements[rotation % placements.length]
}
