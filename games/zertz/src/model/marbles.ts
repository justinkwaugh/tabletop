import * as Type from 'typebox'

export enum MarbleColor {
    White = 'white',
    Grey = 'grey',
    Black = 'black'
}

export const MARBLE_COLORS: readonly MarbleColor[] = [
    MarbleColor.White,
    MarbleColor.Grey,
    MarbleColor.Black
]

export type MarbleCounts = Type.Static<typeof MarbleCounts>
export const MarbleCounts = Type.Object({
    [MarbleColor.White]: Type.Integer({ minimum: 0 }),
    [MarbleColor.Grey]: Type.Integer({ minimum: 0 }),
    [MarbleColor.Black]: Type.Integer({ minimum: 0 })
})

export function noMarbles(): MarbleCounts {
    return { [MarbleColor.White]: 0, [MarbleColor.Grey]: 0, [MarbleColor.Black]: 0 }
}

export function totalMarbles(counts: MarbleCounts): number {
    return MARBLE_COLORS.reduce((sum, color) => sum + counts[color], 0)
}

export function hasAnyMarble(counts: MarbleCounts): boolean {
    return totalMarbles(counts) > 0
}
