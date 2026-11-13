import type { BoundingBox, Point } from '@tabletop/common'
import type { ExternalConnectionDefinition, SarMap } from '@tabletop/south-african-railroads'

// A link runs from one settlement through its building box to the other, as printed.
export function linkPath(map: SarMap, linkId: string): string {
    const trackLink = map.link(linkId)
    const [a, b] = trackLink.ends.map((id) => map.settlement(id))
    return `M${a.x} ${a.y} L${trackLink.box.x} ${trackLink.box.y} L${b.x} ${b.y}`
}

export const CONNECTION_STAR_RADIUS = 25
const CONNECTION_LABEL_WIDTH = 150
const CONNECTION_LABEL_HEIGHT = 48

export type ConnectionLabel = Point & { anchor: 'start' | 'middle' }

// Terms print right of the star; nearer the edge they stack above it.
export function connectionLabel(
    connection: ExternalConnectionDefinition,
    boardWidth: number
): ConnectionLabel {
    return connection.x + 30 + CONNECTION_LABEL_WIDTH > boardWidth - 15
        ? { x: connection.x, y: connection.y - 66, anchor: 'middle' }
        : { x: connection.x + 30, y: connection.y - 8, anchor: 'start' }
}

export function connectionLabelBox(
    connection: ExternalConnectionDefinition,
    boardWidth: number
): BoundingBox {
    const label = connectionLabel(connection, boardWidth)
    const left = label.anchor === 'middle' ? label.x - CONNECTION_LABEL_WIDTH / 2 : label.x
    return {
        x: left,
        y: label.y - 14,
        width: CONNECTION_LABEL_WIDTH,
        height: CONNECTION_LABEL_HEIGHT
    }
}
