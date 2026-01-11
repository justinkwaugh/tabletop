import type { BoundingBox } from '../../../graph/dimensions.js'
import type { Point } from '../../../graph/coordinates.js'

export type HexGeometry = {
    center: Point
    vertices: Point[]
    boundingBox: BoundingBox
}
