import type { TrackGauge } from '@tabletop/18xx'
import type { TileAppearance } from './tileAppearance.js'

export type TrackStroke = {
    color: string
    width: number
    dasharray?: string
    linecap?: 'butt'
}

type TrackInk = Pick<TileAppearance, 'ink' | 'paper' | 'trackWidth' | 'trackBorderWidth'>

// Narrow track prints dashed (1849 §10.3), each dash long enough to read in a tile picker.
const NarrowDash = 1.5
const NarrowGap = 1
// Dual track prints as a white line, kept within the ink of a full-width track.
const DualCentre = 0.4

/**
 * The paper band beneath track of the gauge, ``border`` wider than its ink. Narrow track's band
 * runs only beside its dashes, so the tile shows between them, unless ``continuous``, as where
 * track passes over other track.
 */
export function trackCasing(
    appearance: TrackInk,
    gauge: TrackGauge | undefined,
    border: number,
    continuous = false
): TrackStroke {
    const width = appearance.trackWidth + border
    if (gauge !== 'narrow' || continuous) return { color: appearance.paper, width }
    const { dash, gap } = narrowDashes(appearance)
    return { color: appearance.paper, width, dasharray: `${dash} ${gap}`, linecap: 'butt' }
}

/** The ink strokes of track of the gauge, drawn in order over its casing. */
export function trackInk(appearance: TrackInk, gauge: TrackGauge | undefined): TrackStroke[] {
    const ink = { color: appearance.ink, width: appearance.trackWidth }
    if (gauge === 'narrow') {
        const { dash, gap } = narrowDashes(appearance)
        return [{ ...ink, dasharray: `${dash} ${gap}`, linecap: 'butt' }]
    }
    if (gauge === 'dual')
        return [ink, { color: appearance.paper, width: appearance.trackWidth * DualCentre }]
    return [ink]
}

function narrowDashes(appearance: TrackInk): { dash: number; gap: number } {
    return { dash: appearance.trackWidth * NarrowDash, gap: appearance.trackWidth * NarrowGap }
}
