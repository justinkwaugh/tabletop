export const MAIN_ISLAND_SOURCE_WIDTH = 1049
export const MAIN_ISLAND_SOURCE_HEIGHT = 1248

export const MAIN_ISLAND_DOCK_BOAT_TIP_SOURCE_X = 770
export const MAIN_ISLAND_DOCK_BOAT_CENTER_SOURCE_YS = [497, 577, 657, 737] as const
export const MAIN_ISLAND_OVERFLOW_BOAT_TIP_SOURCE_X = 530
export const MAIN_ISLAND_OVERFLOW_BOAT_CENTER_SOURCE_Y = 1120

export type IslandDockBoatAnchor = {
    tipX: number
    centerY: number
    rotation: number
}

export function getMainIslandDockBoatAnchors(
    islandX: number,
    islandY: number,
    islandWidth: number,
    islandHeight: number
): IslandDockBoatAnchor[] {
    const tipX =
        islandX + islandWidth * (MAIN_ISLAND_DOCK_BOAT_TIP_SOURCE_X / MAIN_ISLAND_SOURCE_WIDTH)

    const dockAnchors = MAIN_ISLAND_DOCK_BOAT_CENTER_SOURCE_YS.map((sourceCenterY) => ({
        tipX,
        centerY: islandY + islandHeight * (sourceCenterY / MAIN_ISLAND_SOURCE_HEIGHT),
        rotation: 0
    }))

    return [
        ...dockAnchors,
        {
            tipX:
                islandX +
                islandWidth * (MAIN_ISLAND_OVERFLOW_BOAT_TIP_SOURCE_X / MAIN_ISLAND_SOURCE_WIDTH),
            centerY:
                islandY +
                islandHeight *
                    (MAIN_ISLAND_OVERFLOW_BOAT_CENTER_SOURCE_Y / MAIN_ISLAND_SOURCE_HEIGHT),
            rotation: 0
        }
    ]
}
