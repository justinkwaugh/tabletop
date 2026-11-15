import farm1 from '$lib/images/farms/farm1.webp'
import farm2 from '$lib/images/farms/farm2.webp'
import farm3 from '$lib/images/farms/farm3.webp'
import farm4 from '$lib/images/farms/farm4.webp'
import farm5 from '$lib/images/farms/farm5.webp'
import farm6 from '$lib/images/farms/farm6.webp'

// Areas are measured in a 551 × 800 frame (the scans are 1240 × 1800, the same crop). Each area
// is the rectangle inside its printed outline: centre, size, and rotation in degrees.
export const FARM_ART_WIDTH = 551
export const FARM_ART_HEIGHT = 800

export type FarmArea = { cx: number; cy: number; width: number; height: number; rotation: number }

export type FarmLayout = {
    image: string
    fields: readonly FarmArea[]
    compost: readonly [FarmArea, FarmArea]
}

function area([cx, cy, width, height, rotation]: readonly number[]): FarmArea {
    return { cx, cy, width, height, rotation }
}

function layout(
    image: string,
    fields: readonly (readonly number[])[],
    compost: readonly [readonly number[], readonly number[]]
): FarmLayout {
    return { image, fields: fields.map(area), compost: [area(compost[0]), area(compost[1])] }
}

// Fields in order 1–5; compost piles 1 and 2.
const FARM_LAYOUTS: Record<number, FarmLayout> = {
    1: layout(
        farm1,
        [
            [118, 408, 200, 200, 0],
            [168, 128, 190, 215, -4],
            [325, 683, 205, 225, 1],
            [452, 455, 185, 205, 3],
            [440, 155, 195, 195, -2]
        ],
        [
            [307, 432, 80, 88, 0],
            [308, 328, 80, 90, 0]
        ]
    ),
    2: layout(
        farm2,
        [
            [418, 662, 205, 205, 0],
            [158, 668, 205, 205, 0],
            [115, 378, 205, 205, 0],
            [130, 130, 205, 205, 0],
            [410, 148, 200, 210, 0]
        ],
        [
            [335, 494, 72, 85, 0],
            [430, 494, 80, 85, 0]
        ]
    ),
    3: layout(
        farm3,
        [
            [152, 684, 205, 205, 0],
            [112, 424, 205, 200, 0],
            [390, 650, 200, 195, 0],
            [437, 415, 190, 205, 0],
            [432, 165, 195, 205, 0]
        ],
        [
            [264, 173, 82, 82, 0],
            [264, 64, 82, 82, 0]
        ]
    ),
    4: layout(
        farm4,
        [
            [126, 566, 215, 205, -1],
            [125, 333, 215, 215, 3],
            [430, 650, 215, 205, -2],
            [432, 382, 205, 200, -2],
            [405, 132, 200, 200, -2]
        ],
        [
            [131, 742, 88, 98, 0],
            [243, 735, 85, 100, -12]
        ]
    ),
    5: layout(
        farm5,
        [
            [395, 668, 215, 215, -4],
            [160, 665, 205, 220, -5],
            [110, 395, 205, 210, 1],
            [118, 152, 220, 200, 4],
            [410, 182, 230, 145, 3]
        ],
        [
            [500, 487, 85, 95, 20],
            [500, 368, 85, 90, 20]
        ]
    ),
    6: layout(
        farm6,
        [
            [410, 570, 195, 215, -18],
            [170, 635, 205, 215, -22],
            [110, 385, 205, 205, 0],
            [135, 135, 195, 195, 8],
            [405, 135, 200, 195, 25]
        ],
        [
            [318, 745, 88, 90, -15],
            [430, 738, 92, 92, -15]
        ]
    )
}

export function farmLayout(farm: number): FarmLayout {
    const layout = FARM_LAYOUTS[farm]
    if (!layout) {
        throw Error(`No farm board ${farm}`)
    }
    return layout
}
