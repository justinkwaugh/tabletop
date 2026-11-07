import { MarbleColor } from '@tabletop/zertz'

// The real grey marbles are flecked with black and the black ones with white.
export const SPECK_COLOR: Record<MarbleColor, string | undefined> = {
    [MarbleColor.White]: undefined,
    [MarbleColor.Grey]: '#111314',
    [MarbleColor.Black]: '#f2f2ee'
}

// Dark specks on grey read as sparser than light specks on black, so grey carries more.
export const SPECK_COUNT: Record<MarbleColor, number> = {
    [MarbleColor.White]: 0,
    [MarbleColor.Grey]: 240,
    [MarbleColor.Black]: 130
}

// mulberry32: a small deterministic generator, so a marble keeps its specks across renders.
export function seededRandom(seed: number): () => number {
    let state = seed | 0
    return () => {
        state = (state + 0x6d2b79f5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
