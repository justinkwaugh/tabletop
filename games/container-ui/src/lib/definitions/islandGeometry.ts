export const MAIN_ISLAND_SOURCE_WIDTH = 1049
export const MAIN_ISLAND_SOURCE_HEIGHT = 1248
export const MAIN_ISLAND_BOUNDARY_PATH =
    'M733.52,953.87l-0.33,88.94c-0.08,21.39,-17.83,38.69,-39.7,38.69h-118.48c-9.01,0,-17.06,-5.54,-20.09,-13.84h0c-4.45,-12.18,-18.16,-18.49,-30.58,-14.07l-57.41,20.43c-13.91,4.96,-28.61,7.48,-43.43,7.48h-150.65c-28.43,0,-54.53,-16.85,-75.05,-41.18,-37.22,-44.15,-47.89,-104.26,-29.41,-158.57l22.67,-66.59c11.71,-34.4,8.15,-72.02,-9.84,-103.74l-5.85,-10.3c-17.09,-30.13,-22.89,-65.2,-16.11,-99.01,1.66,-8.31,3.68,-16.55,6.04,-24.73l5.87,-20.32c13.75,-47.61,11.65,-97.37,1.31,-145.79,-7.63,-35.73,-4.73,-128.82,10.24,-161.65,29.25,-64.13,83,-82.98,159.43,-82.98l116.47,0.71c45.46,0,62.88,50.4,106.1,50h61.77c39.79,0,88.69,17.54,103.47,52.76,8.09,19.3,40.81,59.75,62.14,59.94l56.43,0.52c23.08,0.21,41.7,18.54,41.77,41.12l0.13,40.09c0.07,23.29,-19.21,42.21,-43.01,42.21h-51.42c-9.33,0,-16.95,7.32,-17.13,16.45l-5.33,286.53c-0.24,12.83,10.3,23.38,23.42,23.44l63.41,0.28c17.3,0.08,31.31,13.79,31.36,30.72l0.14,45.85c0.07,20.88,-17.34,37.79,-38.68,37.57l-55.51,-0.57c-44,1.3,-62.35,18.89,-64.2,59.6Z'
export const OFFSHORE_ISLAND_SOURCE_WIDTH = 694.98
export const OFFSHORE_ISLAND_SOURCE_HEIGHT = 864.18
export const OFFSHORE_ISLAND_BOUNDARY_PATH =
    'M 523.36,755.73 c -36.27,15.82,-54.55,7.24,-101.49,-3.74 -13.2,-3.09,-36.92,8.12,-69.64,8.38 -21.13,0.17,-30.21,-8.38,-69.53,-7.75 -53.99,0.85,-67.6,24.89,-96.18,-3.31 -19.45,-19.2,-12.59,-43.47,-25.27,-52.76 -32.51,-23.82,-57.9,-1.03,-57.9,-42.79 l -0.69,-47.49 c -0.18,-12.51,9.37,-22.88,21.24,-23.05 l 76.37,-1.06 -4.15,-252.44 -68.35,-0.2 c -14.02,-0.04,-25.32,-12.17,-25.08,-26.96 0.45,-26.97,2.04,-59.86,2.07,-78.03 s 29.84,-54.69,31.25,-66.94 C 140.46,119.15,140.05,102.64,176.56,99.77 c 0,0,83.21,8.39,114.08,3.26 45.79,-7.62,97.1,3.38,129.44,1.98 23.45,-1.01,78.4,-3.77,109.76,-0.22 41.23,4.67,62.26,18.6,59.74,45.78 -1.42,15.35,-0.23,40.12,3.23,55.09 8.83,38.17,12.26,86.76,7.04,157.24 -1.15,15.51,9.23,31.47,9.4,47.09 0.27,25.65,-8.75,32.54,-8.76,58.6 -0.03,69.02,6.19,170.26,6.19,170.26 0,26.43,-52.28,29.65,-68.01,44.25 -12.17,11.29,14.7,59.51,-15.33,72.62 Z'
export const OFFSHORE_DOCK_BOAT_TIP_SOURCE_X = 228
export const OFFSHORE_DOCK_BOAT_CENTER_SOURCE_YS = [490, 570, 650, 730] as const

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
        rotation: 180
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
            rotation: 180
        }
    ]
}

export function getOffshoreDockBoatAnchors(
    islandX: number,
    islandY: number,
    islandWidth: number,
    islandHeight: number
): IslandDockBoatAnchor[] {
    const tipX = islandX + islandWidth * (OFFSHORE_DOCK_BOAT_TIP_SOURCE_X / (1914 / 2))

    return OFFSHORE_DOCK_BOAT_CENTER_SOURCE_YS.map((sourceCenterY) => ({
        tipX,
        centerY: islandY + islandHeight * (sourceCenterY / (2303 / 2)),
        rotation: 0
    }))
}
