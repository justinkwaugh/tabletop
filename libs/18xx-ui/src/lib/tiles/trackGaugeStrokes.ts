import type { TrackGauge } from '@tabletop/18xx'
import type { TileAppearance } from './tileAppearance.js'

export type TrackStroke = {
    color: string
    width: number
    dasharray?: string
    linecap?: 'butt'
}

type TrackInk = Pick<TileAppearance, 'ink' | 'paper' | 'trackWidth' | 'trackBorderWidth'>

// Narrow track prints as a ladder (1849 §10.3): ink rails along both edges of a paper band, with
// ink ties across it about as long as the gaps between them.
const NarrowBand = 0.66
const NarrowTie = 0.8
const NarrowGap = 0.7
// Dual track prints as a white line, kept within the ink of a full-width track.
const DualCentre = 0.4

/** The paper band beneath track, ``border`` wider than its ink. */
export function trackCasing(appearance: TrackInk, border: number): TrackStroke {
    return { color: appearance.paper, width: appearance.trackWidth + border }
}

/** The ink strokes of track of the gauge, drawn in order over its casing. */
export function trackInk(appearance: TrackInk, gauge: TrackGauge | undefined): TrackStroke[] {
    const ink = { color: appearance.ink, width: appearance.trackWidth }
    if (gauge === 'narrow') {
        const band = appearance.trackWidth * NarrowBand
        return [
            ink,
            { color: appearance.paper, width: band },
            {
                color: appearance.ink,
                width: band,
                dasharray: `${appearance.trackWidth * NarrowTie} ${appearance.trackWidth * NarrowGap}`,
                linecap: 'butt'
            }
        ]
    }
    if (gauge === 'dual')
        return [ink, { color: appearance.paper, width: appearance.trackWidth * DualCentre }]
    return [ink]
}
