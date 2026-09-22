import { TileColors } from './tilePresentation.js'

export type TileAppearance = {
    name: string
    colors: Readonly<Record<string, string>>
    ink: string
    paper: string
    trackWidth: number
    trackBorderWidth: number
    townMarker: 'bar' | 'dot'
    /** Hex outline stroke; defaults to a dark hairline. */
    edge?: { color: string; width: number }
    /** Paper-grain overlay tiled over the hex: an image with alpha, ``size`` in tile units per repeat. */
    grain?: { href: string; size: number; opacity?: number }
    /** Displacement (tile units) applied to ink edges for a hand-inked look; omit for crisp edges. */
    roughness?: number
    /** Station circle ring width; defaults to 1.1. */
    cityRingWidth?: number
    /** Fixed revenue badge: the default ringed circle, or a plain borderless paper disc with black text. */
    revenueBadge?: 'circle' | 'plain'
    /** Labels drawn as a faint tone-on-tone marker instead of text: a ring around the city or an inset hex. */
    labelMarkers?: Readonly<Record<string, 'ring' | 'hex'>>
}

export const ClassicTileAppearance: TileAppearance = Object.freeze({
    name: 'Classic',
    colors: TileColors,
    ink: '#161616',
    paper: '#ffffff',
    trackWidth: 6,
    trackBorderWidth: 2,
    townMarker: 'bar'
})

export const MutedTileAppearance: TileAppearance = Object.freeze({
    name: 'Muted',
    colors: Object.freeze({
        ...TileColors,
        yellow: '#f0d779',
        green: '#a8bf86',
        brown: '#c59d7e',
        gray: '#bfc3c2'
    }),
    ink: '#30342d',
    paper: '#fffdf5',
    trackWidth: 4.5,
    trackBorderWidth: 1.5,
    townMarker: 'dot'
})
