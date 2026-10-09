import * as Type from 'typebox'

export enum CoralColor {
    Grey = 'grey',
    Orange = 'orange',
    Pink = 'pink',
    White = 'white',
    Yellow = 'yellow'
}

export const CoralColors: readonly CoralColor[] = Object.values(CoralColor)

export enum AlgaColor {
    Blue = 'blue',
    Green = 'green',
    Purple = 'purple',
    Red = 'red'
}

export const AlgaColors: readonly AlgaColor[] = Object.values(AlgaColor)

export type AlgaCounts = Type.Static<typeof AlgaCounts>
export const AlgaCounts = Type.Object({
    [AlgaColor.Blue]: Type.Number(),
    [AlgaColor.Green]: Type.Number(),
    [AlgaColor.Purple]: Type.Number(),
    [AlgaColor.Red]: Type.Number()
})

export function algaCounts(count: number = 0): AlgaCounts {
    return {
        [AlgaColor.Blue]: count,
        [AlgaColor.Green]: count,
        [AlgaColor.Purple]: count,
        [AlgaColor.Red]: count
    }
}

export type CoralCounts = Type.Static<typeof CoralCounts>
export const CoralCounts = Type.Object({
    [CoralColor.Grey]: Type.Number(),
    [CoralColor.Orange]: Type.Number(),
    [CoralColor.Pink]: Type.Number(),
    [CoralColor.White]: Type.Number(),
    [CoralColor.Yellow]: Type.Number()
})

export function coralCounts(count: number = 0): CoralCounts {
    return {
        [CoralColor.Grey]: count,
        [CoralColor.Orange]: count,
        [CoralColor.Pink]: count,
        [CoralColor.White]: count,
        [CoralColor.Yellow]: count
    }
}

export function totalCount(counts: CoralCounts): number {
    return CoralColors.reduce((total, color) => total + counts[color], 0)
}

export function countColors(colors: readonly CoralColor[]): CoralCounts {
    const counts = coralCounts()
    for (const color of colors) {
        counts[color] += 1
    }
    return counts
}

export function containsCounts(available: CoralCounts, wanted: CoralCounts): boolean {
    return CoralColors.every((color) => available[color] >= wanted[color])
}
