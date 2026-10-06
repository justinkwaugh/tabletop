import { TileColors } from './tilePresentation.js'
import type { TileDrawingStyle } from './tileDrawing.js'

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
    /** Station circle radius in tile units; defaults to 10. Larger circles space multi-station slots to touch; map tokens fill the circle. */
    citySlotRadius?: number
    /** Fixed revenue badge: the default ringed circle, or a plain borderless paper disc with black text. */
    revenueBadge?: 'circle' | 'plain'
    /** Labels drawn as a tone-on-tone marker instead of text: a ring around the city or an inset hex. */
    labelMarkers?: Readonly<Record<string, 'ring' | 'hex'>>
    /** Printed text for labels, drawn small in place of the label code; may accompany a marker. */
    labelText?: Readonly<Record<string, string>>
    /** Display names for tile colours whose printed name differs (e.g. brown tiles called pink). */
    colorNames?: Readonly<Record<string, string>>
    /** Marker colour per tile colour; tile colours without an entry use a darkened tile colour. */
    markerColors?: Readonly<Record<string, string>>
    /** Behind a multi-station city: a solid ink frame (default) or a paper band with an ink outline. */
    cityBacking?: 'ink' | 'paper'
    /**
     * Fixed revenue circle radius, ring and type; default 8.7, a 0.55 warm gray ring and 10 in the
     * tile font. A set circle's ring defaults to ink.
     */
    revenueCircle?: {
        radius: number
        ringWidth: number
        ringColor?: string
        fontSize: number
        fontFamily?: string
        fontWeight?: number
    }
    /** Label type such as Z or OO; default 12 at weight 850 in the tile font. */
    labelFont?: {
        size: number
        /** Size for labels of three or more characters, such as Chi; defaults to ``size``. */
        longSize?: number
        weight: number
        family?: string
    }
    /** Tile type family; defaults to the ``--tile-font-family`` system sans. */
    fontFamily?: string
    /** Curves a lone one-station city's location name over the top of the city, as 18xx Maker prints it. */
    cityNameArcs?: true
    /** Map hex outline; defaults to a slate hairline. */
    mapOutline?: { color: string; width: number }
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

/** The on-screen style of 18xx Maker (MIT): saturated colours, ink-outlined hexes and large ink-ringed cities. */
export const MakerTileAppearance: TileAppearance = Object.freeze({
    name: '18xx Maker',
    colors: Object.freeze({
        ...TileColors,
        white: '#fcefde',
        yellow: '#ffe600',
        green: '#59b578',
        brown: '#bf8156',
        gray: '#a9afb2',
        red: '#ec2126',
        blue: '#67a7c4'
    }),
    ink: '#110a0c',
    paper: '#ffffff',
    trackWidth: 6.9,
    trackBorderWidth: 2.3,
    townMarker: 'bar',
    edge: { color: 'none', width: 0 },
    cityRingWidth: 1.15,
    citySlotRadius: 14.4,
    cityBacking: 'paper',
    revenueCircle: { radius: 8.1, ringWidth: 1.15, fontSize: 8.7 },
    labelFont: {
        size: 17.3,
        longSize: 11.5,
        weight: 700,
        family: "Bitter, 'Roboto Slab', Rockwell, Georgia, serif"
    },
    fontFamily: "Lato, 'Helvetica Neue', Arial, sans-serif",
    mapOutline: { color: '#110a0c', width: 1.15 },
    cityNameArcs: true
})

/** 18xx Maker with solid ink between a city's circles, Classic's revenue ring and Inter revenues. */
export const CustomTileAppearance: TileAppearance = Object.freeze({
    ...MakerTileAppearance,
    name: 'Custom',
    // Offboards and water about two thirds of the way from 18xx Maker's toward Classic's.
    colors: Object.freeze({ ...MakerTileAppearance.colors, red: '#e76a66', blue: '#89b9d1' }),
    cityBacking: 'ink',
    revenueCircle: {
        radius: 8.1,
        ringWidth: 0.55,
        ringColor: '#5d584a',
        fontSize: 9,
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        fontWeight: 700
    }
})

/** Tile styles a player can choose between. */
export const TileAppearances: readonly TileAppearance[] = Object.freeze([
    ClassicTileAppearance,
    MutedTileAppearance,
    MakerTileAppearance,
    CustomTileAppearance
])

/** The measurements of a tile style that its tiles' geometry and annotation placement use. */
export function tileDrawingStyle(appearance?: TileAppearance): TileDrawingStyle {
    return {
        citySlotRadius: appearance?.citySlotRadius,
        labelFontSize: appearance?.labelFont?.size,
        cityNameArcs: appearance?.cityNameArcs,
        longLabelFontSize: appearance?.labelFont?.longSize
    }
}
