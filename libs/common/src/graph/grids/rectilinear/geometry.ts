import type { BoundingBox } from '../../../graph/dimensions.js'
import type { Point } from '../../../graph/coordinates.js'

export type CellGeometry = {
    center: Point
    vertices: Point[]
    boundingBox: BoundingBox
}
