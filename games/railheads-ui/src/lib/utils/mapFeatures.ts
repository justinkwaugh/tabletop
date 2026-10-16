import { assertExists, type AxialCoordinates, type Point } from '@tabletop/common'
import type { EditionMap } from '@tabletop/railheads'
import type { BoardLayout } from './boardLayout.js'

export type Segment = { from: Point; to: Point }

export type RegionLabel = { id: string; name: string; at: Point }

export function regionBorders(map: EditionMap, layout: BoardLayout): Segment[] {
    return map.hexes().flatMap((place) =>
        map
            .neighborsAt(place.coords)
            .filter(
                (neighbour) =>
                    neighbour.id > place.id &&
                    neighbour.regionId !== undefined &&
                    place.regionId !== undefined &&
                    neighbour.regionId !== place.regionId
            )
            .map((neighbour) =>
                sharedEdge(
                    layout.hexCenter(place.coords),
                    layout.hexCenter(neighbour.coords),
                    layout.hexRadius
                )
            )
    )
}

// Neighbouring regular hexes meet on an edge one radius long, centred between their centres.
function sharedEdge(a: Point, b: Point, radius: number): Segment {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const across = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length }
    const half = radius / 2
    return {
        from: { x: mid.x + across.x * half, y: mid.y + across.y * half },
        to: { x: mid.x - across.x * half, y: mid.y - across.y * half }
    }
}

export function regionLabels(
    map: EditionMap,
    layout: BoardLayout,
    placements: Readonly<Record<string, AxialCoordinates>>
): RegionLabel[] {
    return map.regions.map((region) => {
        const at = placements[region.id]
        assertExists(at, `No label placement for ${region.name}`)
        return { id: region.id, name: region.name, at: layout.hexCenter(at) }
    })
}
