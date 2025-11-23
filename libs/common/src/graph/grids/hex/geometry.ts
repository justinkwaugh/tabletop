import { BoundingBox } from '../../../graph/dimensions.js'
import { Point } from '../../../graph/coordinates.js'

export type HexGeometry = {
    center: Point
    vertices: Point[]
    boundingBox: BoundingBox
}
