import { MarbleColor } from '@tabletop/zertz'

export type GradientStop = { offset: number; color: string }

export const MARBLE_BODY_STOPS: Record<MarbleColor, readonly GradientStop[]> = {
    [MarbleColor.White]: [
        { offset: 0, color: '#ffffff' },
        { offset: 0.55, color: '#ebe7de' },
        { offset: 1, color: '#a9a193' }
    ],
    [MarbleColor.Grey]: [
        { offset: 0, color: '#9ba1a5' },
        { offset: 0.55, color: '#70777b' },
        { offset: 1, color: '#33383b' }
    ],
    [MarbleColor.Black]: [
        { offset: 0, color: '#26292b' },
        { offset: 0.55, color: '#0a0b0c' },
        { offset: 1, color: '#000000' }
    ]
}

// The real grey marbles are flecked with black and the black ones with white.
export const SPECK_COLOR: Record<MarbleColor, string | undefined> = {
    [MarbleColor.White]: undefined,
    [MarbleColor.Grey]: '#111314',
    [MarbleColor.Black]: '#f2f2ee'
}

// Positions and sizes are fractions of the marble radius, so one field suits any drawn size.
export type Speck = { x: number; y: number; r: number; opacity: number }

// Dark specks on grey read as sparser than light specks on black, so grey carries more.
const SPECK_COUNT: Record<MarbleColor, number> = {
    [MarbleColor.White]: 0,
    [MarbleColor.Grey]: 240,
    [MarbleColor.Black]: 130
}
const SPECK_REACH = 0.9

export function speckField(color: MarbleColor, seed: number, density: number = 1): Speck[] {
    const count = Math.round(SPECK_COUNT[color] * density)
    const random = seededRandom(seed)
    return Array.from({ length: count }, () => {
        const angle = random() * Math.PI * 2
        const distance = SPECK_REACH * Math.sqrt(random())
        return {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            r: 0.018 + 0.036 * random() ** 2,
            opacity: 0.95 - 0.55 * distance ** 2
        }
    })
}

// mulberry32: a small deterministic generator, so a marble keeps its specks across renders.
function seededRandom(seed: number): () => number {
    let state = seed | 0
    return () => {
        state = (state + 0x6d2b79f5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
