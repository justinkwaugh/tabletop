import { ClassicTileAppearance, type TileAppearance } from '@tabletop/18xx-ui'
import PaperGrain from './images/published/tiles/paper-grain.png'

/**
 * Tile style matching the Boda Games punch tiles: measured tile colours, near-black
 * hand-inked track without casing, heavy-ringed white station circles, plain white
 * revenue discs, paper grain, and the printed markers for X (ring) and T (inset hex) tiles.
 * See images/published/tiles/style.json for the measurements.
 */
export const TheOldPrincePublishedTileAppearance: TileAppearance = Object.freeze({
    name: 'Old Prince published',
    // Median paper colour of each tier on the punch sheets, converted through the sheets'
    // embedded SWOP profile (yellow and green agree with the printed board within a few points).
    colors: Object.freeze({
        ...ClassicTileAppearance.colors,
        yellow: '#dfbf7a',
        green: '#a3c082',
        brown: '#cba09d',
        gray: '#bab7b3'
    }),
    ink: '#252121',
    paper: '#f7f3ed',
    trackWidth: 6.2,
    trackBorderWidth: 0,
    townMarker: 'dot',
    edge: { color: 'rgb(0 0 0 / 0.16)', width: 0.6 },
    // 240 px of a 300 dpi punch tile is 40 tile units (the 520 px punch hex is 86.6 units wide).
    grain: { href: PaperGrain, size: 40 },
    roughness: 1.0,
    // Printed circles: white hole about radius 9.7 with a heavy ring out to 12.5 on the tiles,
    // and rings at about 12.8 on the board, so the token fills a larger hole than the classic style.
    cityRingWidth: 3,
    citySlotRadius: 11,
    mapTokenSize: 22,
    revenueBadge: 'plain',
    // The Charlottetown gray tile (CX) prints the ring plus the city name instead of a code.
    labelMarkers: { X: 'ring', T: 'hex', CX: 'ring' } as const,
    labelText: { CX: 'Charlottetown' },
    // The published tiles and player aid call the brown tier pink.
    colorNames: { brown: 'pink' },
    // Printed marker colours per tier, measured on the punch sheets.
    markerColors: { yellow: '#cfa661', green: '#7ea169', brown: '#b5807c', gray: '#9a9692' }
})
