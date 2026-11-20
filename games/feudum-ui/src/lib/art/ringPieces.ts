/**
 * `file` is `draw` plus a margin, so a scaled draw's edge reads the same pixels the whole board
 * did; drawn rects overlap their neighbours a few px, so no seam shows.
 */
export const RingSource = { width: 3750, height: 1430 } as const

type Rect = readonly [x: number, y: number, width: number, height: number]

export const RingParts = [
    { part: 'top', draw: [0, 0, 3750, 104], file: [0, 0, 3750, 128] },
    { part: 'bottom', draw: [0, 1325, 3750, 105], file: [0, 1280, 3750, 150] },
    { part: 'west', draw: [0, 88, 104, 1253], file: [0, 64, 128, 1312] },
    { part: 'west-map', draw: [664, 88, 25, 1253], file: [640, 64, 96, 1312] },
    { part: 'east-map', draw: [3064, 88, 24, 1253], file: [3040, 64, 64, 1312] },
    { part: 'east', draw: [3647, 88, 103, 1253], file: [3616, 64, 134, 1312] },
    { part: 'west-gap-1', draw: [88, 494, 592, 26], file: [64, 448, 640, 96] },
    { part: 'west-gap-2', draw: [88, 909, 592, 26], file: [64, 864, 640, 96] },
    { part: 'east-gap-1', draw: [3072, 494, 591, 26], file: [3040, 448, 640, 96] },
    { part: 'east-gap-2', draw: [3072, 909, 591, 26], file: [3040, 864, 640, 96] }
] as const satisfies readonly { part: string; draw: Rect; file: Rect }[]

export type RingPart = (typeof RingParts)[number]['part']
