import type { Point } from '@tabletop/common'

export enum BoardStyle {
    Chart = 'Chart',
    Redesign = 'Redesign'
}

// What lanes, cogs and the guild master need to know about a board's picture.
export interface BoardGeometry {
    width: number
    height: number
    seaCentre: Point
    harbour(city: number): Point
    guildMasterSpot(city: number): Point
}
