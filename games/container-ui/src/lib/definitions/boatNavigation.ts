import type { Point } from '@tabletop/common'
import {
    buildOpenWaterSlots,
    type OpenWaterSlot as OpenWaterAnchor
} from '$lib/definitions/boatHoldingAreas.js'
import type { BoardLayout, PlayerBoardSeat } from '$lib/definitions/boardLayout.js'
import { buildTransitChannelAnchors } from '$lib/definitions/boatTransitChannels.js'
import {
    DEFAULT_BOAT_RENDER_HEIGHT,
    DEFAULT_BOAT_RENDER_WIDTH
} from '$lib/definitions/boatGeometry.js'
import {
    buildLargeConnectorPlacements,
    buildSideConnectorPlacements,
    LARGE_CONNECTOR_LAND_PATH,
    sampleConnectorPolygon,
    SIDE_CONNECTOR_LAND_PATH
} from '$lib/definitions/connectorGeometry.js'
import { polygonFromRect } from '$lib/definitions/geometry2d.js'
import {
    getMainIslandDockBoatAnchors,
    getOffshoreDockBoatAnchors,
    MAIN_ISLAND_BOUNDARY_PATH,
    MAIN_ISLAND_SOURCE_HEIGHT,
    MAIN_ISLAND_SOURCE_WIDTH,
    OFFSHORE_ISLAND_BOUNDARY_PATH,
    OFFSHORE_ISLAND_SOURCE_HEIGHT,
    OFFSHORE_ISLAND_SOURCE_WIDTH
} from '$lib/definitions/islandGeometry.js'
import { getPlayerBoardDockBoatAnchors } from '$lib/definitions/playerBoardGeometry.js'
import { sampleSvgPathToPolygon } from '$lib/definitions/svgPathSampler.js'

export type BoatPose = {
    x: number
    y: number
    heading: number
}

export type DockSlot = {
    id: string
    family: 'main-island-harbor' | 'offshore-harbor' | 'player-board'
    dockedPose: BoatPose
    stagingPose: BoatPose
}

export type OpenWaterSlot = {
    id: string
    family: 'open-water'
    parkedPose: BoatPose
    stagingPose: BoatPose
}

export type RouteEndpoint = DockSlot | OpenWaterSlot

export type NavigationObstacle = {
    id: string
    polygon: Point[]
}

export type TransitChannel = {
    id: string
    x: number
    y: number
    width: number
    height: number
}

export type BoatNavigationGeometry = {
    boardWidth: number
    boardHeight: number
    boatWidth: number
    boatHeight: number
    openWaterSlots: OpenWaterSlot[]
    mainIslandDockSlots: DockSlot[]
    offshoreDockSlots: DockSlot[]
    playerBoardDockSlots: DockSlot[]
    transitChannels: TransitChannel[]
    obstacles: NavigationObstacle[]
}

const PLAYER_BOARD_DOCK_STAGING_DISTANCE = 76
const MAIN_ISLAND_DOCK_STAGING_DISTANCE = 84
const OPEN_WATER_STAGING_DISTANCE = 300
const NAVIGATION_ISLAND_BOUNDARY_SUBDIVISIONS = 8

function degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180
}

function dockAnchorToPose(
    anchor: { tipX: number; centerY: number; rotation: number },
    boatWidth: number
): BoatPose {
    const heading = degreesToRadians(anchor.rotation)
    return {
        x: anchor.tipX - Math.cos(heading) * (boatWidth / 2),
        y: anchor.centerY - Math.sin(heading) * (boatWidth / 2),
        heading
    }
}

function createStagingPose(dockedPose: BoatPose, distance: number): BoatPose {
    return {
        x: dockedPose.x - Math.cos(dockedPose.heading) * distance,
        y: dockedPose.y - Math.sin(dockedPose.heading) * distance,
        heading: dockedPose.heading
    }
}

function openWaterAnchorToSlot(anchor: OpenWaterAnchor): OpenWaterSlot {
    const parkedPose = {
        x: anchor.x,
        y: anchor.y,
        heading: anchor.heading
    }
    return {
        id: anchor.id,
        family: 'open-water',
        parkedPose,
        stagingPose: createStagingPose(parkedPose, OPEN_WATER_STAGING_DISTANCE)
    }
}

function createPlayerBoardObstacle(seat: PlayerBoardSeat): NavigationObstacle {
    return {
        id: `player-board-${seat.playerId}`,
        polygon: polygonFromRect(seat.x, seat.y, seat.width, seat.height)
    }
}

function createMainIslandObstacle(boardLayout: BoardLayout): NavigationObstacle {
    const { islandRect } = boardLayout
    return {
        id: 'main-island',
        polygon: sampleSvgPathToPolygon(MAIN_ISLAND_BOUNDARY_PATH, {
            cubicSubdivisions: NAVIGATION_ISLAND_BOUNDARY_SUBDIVISIONS,
            scaleX: islandRect.width / MAIN_ISLAND_SOURCE_WIDTH,
            scaleY: islandRect.height / MAIN_ISLAND_SOURCE_HEIGHT,
            offsetX: islandRect.x,
            offsetY: islandRect.y
        })
    }
}

function createOffshoreObstacle(boardLayout: BoardLayout): NavigationObstacle[] {
    if (!boardLayout.offshoreRect) {
        return []
    }

    return [
        {
            id: 'offshore-island',
            polygon: sampleSvgPathToPolygon(OFFSHORE_ISLAND_BOUNDARY_PATH, {
                cubicSubdivisions: NAVIGATION_ISLAND_BOUNDARY_SUBDIVISIONS,
                scaleX: boardLayout.offshoreRect.width / OFFSHORE_ISLAND_SOURCE_WIDTH,
                scaleY: boardLayout.offshoreRect.height / OFFSHORE_ISLAND_SOURCE_HEIGHT,
                offsetX: boardLayout.offshoreRect.x,
                offsetY: boardLayout.offshoreRect.y
            })
        }
    ]
}

function createConnectorObstacles(boardLayout: BoardLayout): NavigationObstacle[] {
    const largeConnectorObstacles = buildLargeConnectorPlacements(
        boardLayout.playerBoardSeats
    ).map((placement): NavigationObstacle => ({
        id: `large-connector-${placement.key}`,
        polygon: sampleConnectorPolygon(LARGE_CONNECTOR_LAND_PATH, placement)
    }))

    const sideConnectorObstacles = buildSideConnectorPlacements(
        boardLayout.playerBoardSeats
    ).map((placement): NavigationObstacle => ({
        id: `side-connector-${placement.key}`,
        polygon: sampleConnectorPolygon(SIDE_CONNECTOR_LAND_PATH, placement)
    }))

    return [...largeConnectorObstacles, ...sideConnectorObstacles]
}

export function buildBoatNavigationGeometry(boardLayout: BoardLayout): BoatNavigationGeometry {
    const openWaterSlots = buildOpenWaterSlots(boardLayout).map(openWaterAnchorToSlot)
    const transitChannels = buildTransitChannelAnchors(boardLayout)
    const mainIslandDockSlots = getMainIslandDockBoatAnchors(
        boardLayout.islandRect.x,
        boardLayout.islandRect.y,
        boardLayout.islandRect.width,
        boardLayout.islandRect.height,
        { includeOverflow: boardLayout.playerBoardSeats.length === 5 }
    ).map((anchor, index): DockSlot => {
        const dockedPose = dockAnchorToPose(anchor, DEFAULT_BOAT_RENDER_WIDTH)
        return {
            id: `main-island-dock-${index}`,
            family: 'main-island-harbor',
            dockedPose,
            stagingPose: createStagingPose(dockedPose, MAIN_ISLAND_DOCK_STAGING_DISTANCE)
        }
    })

    const offshoreDockSlots = boardLayout.offshoreRect
        ? getOffshoreDockBoatAnchors(
              boardLayout.offshoreRect.x,
              boardLayout.offshoreRect.y,
              boardLayout.offshoreRect.width,
              boardLayout.offshoreRect.height
          ).map((anchor, index): DockSlot => {
              const dockedPose = dockAnchorToPose(anchor, DEFAULT_BOAT_RENDER_WIDTH)
              return {
                  id: `offshore-dock-${index}`,
                  family: 'offshore-harbor',
                  dockedPose,
                  stagingPose: createStagingPose(dockedPose, MAIN_ISLAND_DOCK_STAGING_DISTANCE)
              }
          })
        : []

    const playerBoardDockSlots = boardLayout.playerBoardSeats.flatMap((seat) =>
        getPlayerBoardDockBoatAnchors(seat.orientation, seat.width, seat.height).map(
            (anchor, index): DockSlot => {
                const dockedPose = dockAnchorToPose(
                    {
                        ...anchor,
                        tipX: seat.x + anchor.tipX,
                        centerY: seat.y + anchor.centerY
                    },
                    DEFAULT_BOAT_RENDER_WIDTH
                )

                return {
                    id: `${seat.playerId}-dock-${index}`,
                    family: 'player-board',
                    dockedPose,
                    stagingPose: createStagingPose(dockedPose, PLAYER_BOARD_DOCK_STAGING_DISTANCE)
                }
            }
        )
    )

    const obstacles = [
        createMainIslandObstacle(boardLayout),
        ...createOffshoreObstacle(boardLayout),
        ...createConnectorObstacles(boardLayout),
        ...boardLayout.playerBoardSeats.map(createPlayerBoardObstacle)
    ]

    return {
        boardWidth: boardLayout.boardWidth,
        boardHeight: boardLayout.boardHeight,
        boatWidth: DEFAULT_BOAT_RENDER_WIDTH,
        boatHeight: DEFAULT_BOAT_RENDER_HEIGHT,
        openWaterSlots,
        mainIslandDockSlots,
        offshoreDockSlots,
        playerBoardDockSlots,
        transitChannels,
        obstacles
    }
}

export function getBoatFootprintPolygon(
    pose: BoatPose,
    width: number = DEFAULT_BOAT_RENDER_WIDTH,
    height: number = DEFAULT_BOAT_RENDER_HEIGHT
): Point[] {
    return transformBoatLocalPolygon(
        pose,
        [
            { x: -width / 2, y: -height / 2 },
            { x: width / 2, y: -height / 2 },
            { x: width / 2, y: height / 2 },
            { x: -width / 2, y: height / 2 }
        ]
    )
}

export function getMovingBoatFootprintPolygon(
    pose: BoatPose,
    width: number = DEFAULT_BOAT_RENDER_WIDTH,
    height: number = DEFAULT_BOAT_RENDER_HEIGHT
): Point[] {
    return getBoatFootprintPolygon(pose, width, height)
}

function transformBoatLocalPolygon(
    pose: BoatPose,
    localPoints: Point[]
): Point[] {
    const cos = Math.cos(pose.heading)
    const sin = Math.sin(pose.heading)

    return localPoints.map((point) => ({
        x: pose.x + point.x * cos - point.y * sin,
        y: pose.y + point.x * sin + point.y * cos
    }))
}
