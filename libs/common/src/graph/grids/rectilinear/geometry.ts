import { BoundingBox } from '../../../graph/dimensions.js'
import { Point } from '../../../graph/coordinates.js'

export type CellGeometry = {
    center: Point
    vertices: Point[]
    boundingBox: BoundingBox
}
