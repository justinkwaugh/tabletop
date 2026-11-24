import type { BoundingBox } from '@tabletop/common'

export const RingSource = { width: 3750, height: 1430 } as const

/** `file` is `draw` plus a margin and drawn rects overlap a few px, so no seam shows. */
export const RingParts = [
    {
        part: 'top',
        draw: { x: 0, y: 0, width: 3750, height: 104 },
        file: { x: 0, y: 0, width: 3750, height: 128 }
    },
    {
        part: 'bottom',
        draw: { x: 0, y: 1325, width: 3750, height: 105 },
        file: { x: 0, y: 1280, width: 3750, height: 150 }
    },
    {
        part: 'west',
        draw: { x: 0, y: 88, width: 104, height: 1253 },
        file: { x: 0, y: 64, width: 128, height: 1312 }
    },
    {
        part: 'west-map',
        draw: { x: 664, y: 88, width: 25, height: 1253 },
        file: { x: 640, y: 64, width: 96, height: 1312 }
    },
    {
        part: 'east-map',
        draw: { x: 3064, y: 88, width: 24, height: 1253 },
        file: { x: 3040, y: 64, width: 64, height: 1312 }
    },
    {
        part: 'east',
        draw: { x: 3647, y: 88, width: 103, height: 1253 },
        file: { x: 3616, y: 64, width: 134, height: 1312 }
    },
    {
        part: 'west-gap-1',
        draw: { x: 88, y: 494, width: 592, height: 26 },
        file: { x: 64, y: 448, width: 640, height: 96 }
    },
    {
        part: 'west-gap-2',
        draw: { x: 88, y: 909, width: 592, height: 26 },
        file: { x: 64, y: 864, width: 640, height: 96 }
    },
    {
        part: 'east-gap-1',
        draw: { x: 3072, y: 494, width: 591, height: 26 },
        file: { x: 3040, y: 448, width: 640, height: 96 }
    },
    {
        part: 'east-gap-2',
        draw: { x: 3072, y: 909, width: 591, height: 26 },
        file: { x: 3040, y: 864, width: 640, height: 96 }
    }
] as const satisfies readonly { part: string; draw: BoundingBox; file: BoundingBox }[]

export type RingPart = (typeof RingParts)[number]['part']
