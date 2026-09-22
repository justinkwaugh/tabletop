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
    // Yellow and green are sampled from the printed board's tile hexes so laid tiles sit
    // with the preprinted ones; brown and gray come from the punch sheets, slightly muted
    // to match the board's tone.
    colors: Object.freeze({
        ...ClassicTileAppearance.colors,
        yellow: '#debc73',
        green: '#a5b980',
        brown: '#c9a0ad',
        gray: '#bcc2bf'
    }),
    ink: '#111111',
    paper: '#ffffff',
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
    labelMarkers: { X: 'ring', T: 'hex' } as const
})
