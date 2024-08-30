import { Type, type Static } from '@sinclair/typebox'
import { CubeCoordinates } from '@tabletop/common'
import { Boat } from '../components/boat.js'

export enum CellType {
    Water = 'Water',
    Cult = 'Cult',
    MeetingHut = 'MeetingHut',
    FishermanHut = 'FishermanHut'
}

export type BaseCell = Static<typeof BaseCell>
export const BaseCell = Type.Object({
    type: Type.Enum(CellType),
    coords: CubeCoordinates
})

export type WaterCell = Static<typeof WaterCell>
export const WaterCell = Type.Object({
    ...BaseCell.properties,
    type: Type.Literal(CellType.Water),
    boat: Boat
})

export type CultCell = Static<typeof CultCell>
export const CultCell = Type.Object({
    ...BaseCell.properties,
    type: Type.Literal(CellType.Cult)
})

export type MeetingHutCell = Static<typeof MeetingHutCell>
export const MeetingHutCell = Type.Object({
    ...BaseCell.properties,
    type: Type.Literal(CellType.MeetingHut),
    owner: Type.String()
})

export type FishermanHutCell = Static<typeof FishermanHutCell>
export const FishermanHutCell = Type.Object({
    ...BaseCell.properties,
    type: Type.Literal(CellType.FishermanHut),
    owner: Type.String()
})

export type Cell = Static<typeof Cell>
export const Cell = Type.Union([WaterCell, CultCell, MeetingHutCell, FishermanHutCell])
