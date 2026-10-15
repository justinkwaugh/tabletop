import { MarbleColor } from '@tabletop/zertz'

export type GradientStop = { offset: number; color: string }

export const MARBLE_BODY_STOPS: Record<MarbleColor, readonly GradientStop[]> = {
    [MarbleColor.White]: [
        { offset: 0, color: '#ffffff' },
        { offset: 0.55, color: '#ebe7de' },
        { offset: 1, color: '#a9a193' }
    ],
    [MarbleColor.Grey]: [
        { offset: 0, color: '#c4c9cc' },
        { offset: 0.55, color: '#8d9396' },
        { offset: 1, color: '#4b5154' }
    ],
    [MarbleColor.Black]: [
        { offset: 0, color: '#41474a' },
        { offset: 0.55, color: '#16191a' },
        { offset: 1, color: '#000000' }
    ]
}

// The real grey marbles are flecked with black and the black ones with white.
export const SPECK_COLOR: Record<MarbleColor, string | undefined> = {
    [MarbleColor.White]: undefined,
    [MarbleColor.Grey]: '#111314',
    [MarbleColor.Black]: '#f2f2ee'
}

export const SPECK_TILE = { width: 13, height: 11 }

export const SPECKS: readonly { x: number; y: number; r: number }[] = [
    { x: 1.5, y: 2, r: 0.9 },
    { x: 6, y: 1, r: 0.6 },
    { x: 10.5, y: 3.5, r: 1.1 },
    { x: 3.5, y: 6.5, r: 0.7 },
    { x: 8, y: 7.5, r: 0.9 },
    { x: 12, y: 9, r: 0.6 },
    { x: 1, y: 10, r: 0.8 },
    { x: 6.5, y: 10.5, r: 0.5 }
]
