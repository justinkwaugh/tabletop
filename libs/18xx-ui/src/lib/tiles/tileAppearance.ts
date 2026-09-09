import { TileColors } from './tilePresentation.js'

export type TileAppearance = {
    name: string
    colors: Readonly<Record<string, string>>
    ink: string
    paper: string
    trackWidth: number
    trackBorderWidth: number
    townMarker: 'bar' | 'dot'
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
