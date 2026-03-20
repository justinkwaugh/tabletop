import type { Point } from '@tabletop/common'
import type { PlayerBoardSeat, PlayerBoardOrientation } from '$lib/definitions/boardLayout.js'
import { sampleSvgPathToPolygon } from '$lib/definitions/svgPathSampler.js'

export const BOARD_SOURCE_WIDTH = 448
export const BOARD_SOURCE_HEIGHT = 755
export const LARGE_CONNECTOR_SOURCE_WIDTH = 623.07
export const LARGE_CONNECTOR_SOURCE_HEIGHT = 500
export const LARGE_CONNECTOR_OVERLAP_Y = 110
export const LARGE_CONNECTOR_OFFSET_X = -35
export const SIDE_CONNECTOR_SOURCE_WIDTH = 863.09
export const SIDE_CONNECTOR_SOURCE_HEIGHT = 568.78
export const SIDE_CONNECTOR_TOP_OFFSET_X = -262
export const SIDE_CONNECTOR_TOP_OFFSET_Y = 130
export const SIDE_CONNECTOR_BOTTOM_OFFSET_X = -215
export const SIDE_CONNECTOR_BOTTOM_OFFSET_Y = -160

export const LARGE_CONNECTOR_LAND_PATH =
    'M472.42,470.27l-472.42.16V121.97l588.26-1.97c4.5,12.67,36.56,47.34,34.74,81.95-2.4,45.56-36.71,70.48-41.21,118.52-3.56,38.03-11.59,79.37-67.62,103.64-26.98,11.69-17.36,10.14-41.75,46.16Z'
export const SIDE_CONNECTOR_LAND_PATH =
    'M514.7,373.28s-278.27,10.81-307.04,65.23c-16.3,30.83-87.66-14.43-87.66-47.43V121.42l588.26-1.42c4.5,9.16,36.56,34.23,34.74,59.26-2.4,32.94-36.71,50.96-41.21,85.69-3.56,27.5-11.59,57.39-67.62,74.94-9.44,2.96-14.4,4.74-17.91,6.93-28.06,17.52-64.48,26.45-101.56,26.46Z'

export type ConnectorPlacement = {
    key: string
    width: number
    height: number
    x: number
    y: number
    flipX: boolean
    flipY: boolean
}

function getScaledSize(
    seat: PlayerBoardSeat,
    sourceWidth: number,
    sourceHeight: number
): { width: number; height: number } {
    return {
        width: seat.width * (sourceWidth / BOARD_SOURCE_WIDTH),
        height: seat.height * (sourceHeight / BOARD_SOURCE_HEIGHT)
    }
}

function sortSeatsByOrientation(
    seats: PlayerBoardSeat[],
    orientation: PlayerBoardOrientation
): PlayerBoardSeat[] {
    return seats
        .filter((seat) => seat.orientation === orientation)
        .sort((a, b) => a.y - b.y)
}

export function buildLargeConnectorPlacements(seats: PlayerBoardSeat[]): ConnectorPlacement[] {
    const orderedSeats = [
        ...sortSeatsByOrientation(seats, 'left'),
        ...sortSeatsByOrientation(seats, 'right')
    ]

    return orderedSeats
        .map((seat, index, ordered) => {
            const nextSeat = ordered[index + 1]
            if (!nextSeat || nextSeat.orientation !== seat.orientation) {
                return null
            }

            const { width, height } = getScaledSize(
                seat,
                LARGE_CONNECTOR_SOURCE_WIDTH,
                LARGE_CONNECTOR_SOURCE_HEIGHT
            )

            return {
                key: `${seat.playerId}-${nextSeat.playerId}`,
                width,
                height,
                x:
                    seat.orientation === 'left'
                        ? seat.x + LARGE_CONNECTOR_OFFSET_X
                        : seat.x + seat.width - LARGE_CONNECTOR_OFFSET_X,
                y: seat.y + seat.height - LARGE_CONNECTOR_OVERLAP_Y,
                flipX: seat.orientation === 'right',
                flipY: false
            }
        })
        .filter((placement): placement is ConnectorPlacement => !!placement)
}

export function buildSideConnectorPlacements(seats: PlayerBoardSeat[]): ConnectorPlacement[] {
    const seatsByOrientation = [
        sortSeatsByOrientation(seats, 'left'),
        sortSeatsByOrientation(seats, 'right')
    ]

    return seatsByOrientation.flatMap((orientedSeats) =>
        orientedSeats.flatMap((seat, index) => {
            const placements: ConnectorPlacement[] = []
            const { width, height } = getScaledSize(
                seat,
                SIDE_CONNECTOR_SOURCE_WIDTH,
                SIDE_CONNECTOR_SOURCE_HEIGHT
            )

            if (index === 0) {
                placements.push({
                    key: `${seat.playerId}-top`,
                    width,
                    height,
                    x:
                        seat.orientation === 'left'
                            ? seat.x + SIDE_CONNECTOR_TOP_OFFSET_X
                            : seat.x + seat.width - SIDE_CONNECTOR_TOP_OFFSET_X,
                    y: seat.y + SIDE_CONNECTOR_TOP_OFFSET_Y,
                    flipX: seat.orientation === 'right',
                    flipY: true
                })
            }

            if (index === orientedSeats.length - 1) {
                placements.push({
                    key: `${seat.playerId}-bottom`,
                    width,
                    height,
                    x:
                        seat.orientation === 'left'
                            ? seat.x + SIDE_CONNECTOR_BOTTOM_OFFSET_X
                            : seat.x + seat.width - SIDE_CONNECTOR_BOTTOM_OFFSET_X,
                    y: seat.y + seat.height + SIDE_CONNECTOR_BOTTOM_OFFSET_Y,
                    flipX: seat.orientation === 'right',
                    flipY: false
                })
            }

            return placements
        })
    )
}

export function connectorPlacementToSvgTransform(placement: ConnectorPlacement): string {
    const scaleX = placement.flipX ? -1 : 1
    const scaleY = placement.flipY ? -1 : 1
    return `translate(${placement.x} ${placement.y}) scale(${scaleX} ${scaleY})`
}

export function sampleConnectorPolygon(
    path: string,
    placement: ConnectorPlacement
): Point[] {
    const sampled = sampleSvgPathToPolygon(path, {
        scaleX: placement.width / getPathSourceWidth(path),
        scaleY: placement.height / getPathSourceHeight(path)
    })

    return sampled.map((point) => ({
        x: placement.flipX ? placement.x - point.x : placement.x + point.x,
        y: placement.flipY ? placement.y - point.y : placement.y + point.y
    }))
}

function getPathSourceWidth(path: string): number {
    return path === LARGE_CONNECTOR_LAND_PATH ?
            LARGE_CONNECTOR_SOURCE_WIDTH
        : SIDE_CONNECTOR_SOURCE_WIDTH
}

function getPathSourceHeight(path: string): number {
    return path === LARGE_CONNECTOR_LAND_PATH ?
            LARGE_CONNECTOR_SOURCE_HEIGHT
        : SIDE_CONNECTOR_SOURCE_HEIGHT
}
