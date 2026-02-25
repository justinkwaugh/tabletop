import type { Point } from '@tabletop/common'
import { boardAreaPathById } from '$lib/definitions/boardGeometry.js'
import { LAND_MARKER_POSITIONS } from '$lib/definitions/landMarkerPositions.js'
import { getPathCenter } from '$lib/utils/geometry.js'

export function resolveLandMarkerPosition(areaId: string): Point | null {
    const markerPosition = LAND_MARKER_POSITIONS[areaId]
    if (markerPosition) {
        return markerPosition
    }

    const areaPath = boardAreaPathById(areaId)
    if (!areaPath) {
        return null
    }

    return getPathCenter(areaPath)
}
