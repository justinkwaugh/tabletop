import {
    HexOrientation,
    calculateHexGeometry,
    circleDimensionsToElliptical,
    hexCoordsToCenterPoint,
    type AxialCoordinates,
    type Point,
    type RectangleDimensions
} from '@tabletop/common'
import { EditionId } from '@tabletop/railheads'

export type Panel = Point & RectangleDimensions

export const TRACK_CELL = 42
const REVENUE_STEPS = 100

type BoardLayoutSpec = {
    orientation: HexOrientation
    // Revenue steps along the top edge; the sides take the rest of each half lap.
    stepsAcross: number
    hexRadius: number
    firstHexCenter: Point
    legend: Panel
    endgame: Panel
    logo: Point
}

export class BoardLayout {
    readonly orientation: HexOrientation
    readonly hexRadius: number
    readonly stepsAcross: number
    readonly stepsDown: number
    readonly width: number
    readonly height: number
    readonly corners: ReadonlySet<number>
    readonly legend: Panel
    readonly endgame: Panel
    readonly logo: Point
    private readonly firstHexCenter: Point

    constructor(spec: BoardLayoutSpec) {
        this.orientation = spec.orientation
        this.hexRadius = spec.hexRadius
        this.stepsAcross = spec.stepsAcross
        this.stepsDown = REVENUE_STEPS / 2 - spec.stepsAcross
        this.width = TRACK_CELL * (this.stepsAcross + 1)
        this.height = TRACK_CELL * (this.stepsDown + 1)
        this.corners = new Set([
            0,
            this.stepsAcross,
            REVENUE_STEPS / 2,
            REVENUE_STEPS / 2 + this.stepsAcross
        ])
        this.legend = spec.legend
        this.endgame = spec.endgame
        this.logo = spec.logo
        this.firstHexCenter = spec.firstHexCenter
    }

    hexCenter(coords: AxialCoordinates): Point {
        const offset = hexCoordsToCenterPoint(
            coords,
            circleDimensionsToElliptical({ radius: this.hexRadius }, this.orientation),
            this.orientation
        )
        return { x: this.firstHexCenter.x + offset.x, y: this.firstHexCenter.y + offset.y }
    }

    hexPoints(center: Point, radius: number = this.hexRadius): string {
        return calculateHexGeometry(
            { orientation: this.orientation, dimensions: { radius } },
            { q: 0, r: 0 }
        )
            .vertices.map((vertex) => `${center.x + vertex.x},${center.y + vertex.y}`)
            .join(' ')
    }

    revenueCell(revenue: number): Point {
        const step = ((revenue % REVENUE_STEPS) + REVENUE_STEPS) % REVENUE_STEPS
        const across = this.stepsAcross
        const half = REVENUE_STEPS / 2
        if (step <= across) return { x: step * TRACK_CELL, y: 0 }
        if (step <= half) return { x: across * TRACK_CELL, y: (step - across) * TRACK_CELL }
        if (step <= half + across) {
            return { x: (half + across - step) * TRACK_CELL, y: this.stepsDown * TRACK_CELL }
        }
        return { x: 0, y: (REVENUE_STEPS - step) * TRACK_CELL }
    }

    inwardOf(step: number, reach: number): Point {
        const half = REVENUE_STEPS / 2
        if (step <= this.stepsAcross) return { x: 0, y: reach }
        if (step <= half) return { x: -reach, y: 0 }
        if (step <= half + this.stepsAcross) return { x: 0, y: -reach }
        return { x: reach, y: 0 }
    }
}

const GERMANY_HEX_RADIUS = 36

const BOARD_LAYOUTS: Record<EditionId, BoardLayout> = {
    [EditionId.Germany]: new BoardLayout({
        orientation: HexOrientation.Flat,
        stepsAcross: 20,
        hexRadius: GERMANY_HEX_RADIUS,
        firstHexCenter: {
            x: 54 + GERMANY_HEX_RADIUS,
            y: 59 + (Math.sqrt(3) / 2) * GERMANY_HEX_RADIUS
        },
        legend: { x: 52, y: 54, width: 240, height: 188 },
        endgame: { x: 52, y: 254, width: 156, height: 168 },
        logo: { x: 680, y: 54 }
    }),
    [EditionId.Midwest]: new BoardLayout({
        orientation: HexOrientation.Pointy,
        stepsAcross: 30,
        hexRadius: 32,
        firstHexCenter: { x: 83, y: 144 },
        legend: { x: 52, y: 652, width: 240, height: 184 },
        endgame: { x: 52, y: 412, width: 168, height: 204 },
        logo: { x: 1135, y: 50 }
    })
}

export function boardLayout(editionId: EditionId): BoardLayout {
    return BOARD_LAYOUTS[editionId]
}
