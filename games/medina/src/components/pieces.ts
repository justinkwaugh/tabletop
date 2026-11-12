import type { RectangleDimensions } from '@tabletop/common'

export enum PalaceColor {
    Grey = 'grey',
    Purple = 'purple',
    Brown = 'brown',
    Orange = 'orange'
}

export const PALACE_COLORS = Object.values(PalaceColor)

export const PALACE_TILE_POINTS: Record<PalaceColor, number> = {
    [PalaceColor.Grey]: 1,
    [PalaceColor.Purple]: 2,
    [PalaceColor.Brown]: 3,
    [PalaceColor.Orange]: 4
}

export enum WallSide {
    North = 'north',
    East = 'east',
    South = 'south',
    West = 'west'
}

export const WALL_SIDES = Object.values(WallSide)

export enum Tower {
    NorthWest = 1,
    SouthEast = 2,
    NorthEast = 3,
    SouthWest = 4
}

export const TOWERS = [Tower.NorthWest, Tower.SouthEast, Tower.NorthEast, Tower.SouthWest]

export const TOWER_TILE_POINTS: Record<Tower, number> = {
    [Tower.NorthWest]: 1,
    [Tower.SouthEast]: 2,
    [Tower.NorthEast]: 3,
    [Tower.SouthWest]: 4
}

export const TOWER_TILE_MERCHANTS: Record<Tower, number> = {
    [Tower.NorthWest]: 3,
    [Tower.SouthEast]: 2,
    [Tower.NorthEast]: 1,
    [Tower.SouthWest]: 0
}

// A side's index counts from its first tower to its second: west to east, north to south.
export const SIDE_TOWERS: Record<WallSide, [Tower, Tower]> = {
    [WallSide.North]: [Tower.NorthWest, Tower.NorthEast],
    [WallSide.South]: [Tower.SouthWest, Tower.SouthEast],
    [WallSide.West]: [Tower.NorthWest, Tower.SouthWest],
    [WallSide.East]: [Tower.NorthEast, Tower.SouthEast]
}

export const TEA_TILES_FOR_FIRST_PURPLE_CLAIM = 3

export function boardSize(playerCount: number): RectangleDimensions {
    return playerCount === 2 ? { width: 14, height: 10 } : { width: 16, height: 11 }
}

export type StartingStock = {
    buildingsPerColor: number
    rooftops: number
    neutralRooftops: number
    stables: number
    merchants: number
    walls: number
}

const ROOFTOPS_PER_PLAYER = 4

const STARTING_STOCK: Record<number, StartingStock> = {
    2: {
        buildingsPerColor: 8,
        rooftops: ROOFTOPS_PER_PLAYER,
        neutralRooftops: 2,
        stables: 4,
        merchants: 12,
        walls: 15
    },
    3: {
        buildingsPerColor: 6,
        rooftops: ROOFTOPS_PER_PLAYER,
        neutralRooftops: 1,
        stables: 4,
        merchants: 8,
        walls: 12
    },
    4: {
        buildingsPerColor: 5,
        rooftops: ROOFTOPS_PER_PLAYER,
        neutralRooftops: 0,
        stables: 3,
        merchants: 6,
        walls: 9
    }
}

export function startingStock(playerCount: number): StartingStock {
    return STARTING_STOCK[playerCount]
}

// The first turns of the game place one component instead of two.
export function singlePlacementTurns(playerCount: number): number {
    return playerCount === 2 ? 1 : 2
}
