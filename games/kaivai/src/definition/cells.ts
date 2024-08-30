import { Type, type Static } from '@sinclair/typebox'
import { AxialCoordinates } from '@tabletop/common'
import { Boat } from '../components/boat.js'
import { HutType } from './huts.js'

export enum CellType {
    Water = 'Water',
    Cult = 'Cult',
    Hut = 'Hut'
}

export type BaseCell = Static<typeof BaseCell>
export const BaseCell = Type.Object({
    type: Type.Enum(CellType),
    coords: AxialCoordinates
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
    type: Type.Literal(CellType.Cult),
    islandId: Type.String()
})

export type HutCell = Static<typeof HutCell>
export const HutCell = Type.Object({
    ...BaseCell.properties,
    type: Type.Literal(CellType.Hut),
    islandId: Type.String(),
    hutType: Type.Enum(HutType),
    owner: Type.String()
})

export type Cell = Static<typeof Cell>
export const Cell = Type.Union([WaterCell, CultCell, HutCell])
